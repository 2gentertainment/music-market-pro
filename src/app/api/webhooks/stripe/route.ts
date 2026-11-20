import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { syncCreatorToAweber } from "@/lib/aweber";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TIER_COMMISSION_RATES: Record<string, number> = {
  free: 0.15,   // 15% commission
  artist: 0.10, // 10% commission
  label: 0.05,  // 5% commission
};

function getTierCommissionRate(tier?: string | null): number {
  const normalized = (tier || "free").toLowerCase();
  return TIER_COMMISSION_RATES[normalized] ?? TIER_COMMISSION_RATES.free;
}

async function syncCustomerToAWeber(
  email: string,
  name: string,
  trackId?: string | null
) {
  try {
    await syncCreatorToAweber({
      email,
      name,
      tier: "buyer",
      handle: trackId || undefined,
    });
  } catch (err) {
    console.error("AWeber sync warning (buyer vault):", err);
  }
}

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing Stripe webhook signature or secret" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error("Stripe webhook signature verification failed:", err?.message || err);
    return NextResponse.json(
      { error: `Webhook Error: ${err?.message || "Invalid signature"}` },
      { status: 400 }
    );
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // -------------------------------------------------------------
      // CASE 1: Subscription Tier Upgrades & One-Time Coupon Lock
      // -------------------------------------------------------------
      if (session.mode === "subscription") {
        const profileId = session.metadata?.profileId || session.metadata?.userId;
        const tierFromMetadata = (
          session.metadata?.tierUpgrade ||
          session.metadata?.tierSignup ||
          session.metadata?.tier ||
          ""
        ).toLowerCase();
        const stripeAccountId = session.metadata?.stripeAccountId;
        const customHandle = session.metadata?.customHandle || session.metadata?.handleName;
        const couponCodeUsed = session.metadata?.firstMonthCouponCode || null;
        const fallbackEmail = session.customer_details?.email || session.customer_email;

        let targetProfile: {
          id: string;
          email?: string | null;
          name?: string | null;
          full_name?: string | null;
          handle?: string | null;
          tier?: string | null;
        } | null = null;

        if (profileId) {
          const { data } = await supabase
            .from("profiles")
            .select("id, email, name, full_name, handle, tier")
            .eq("id", profileId)
            .maybeSingle();
          targetProfile = data || null;
        }

        if (!targetProfile && stripeAccountId) {
          const { data } = await supabase
            .from("profiles")
            .select("id, email, name, full_name, handle, tier")
            .eq("stripe_account_id", stripeAccountId)
            .maybeSingle();
          targetProfile = data || null;
        }

        if (!targetProfile && customHandle) {
          const { data } = await supabase
            .from("profiles")
            .select("id, email, name, full_name, handle, tier")
            .eq("handle", customHandle)
            .maybeSingle();
          targetProfile = data || null;
        }

        if (!targetProfile && fallbackEmail) {
          const { data } = await supabase
            .from("profiles")
            .select("id, email, name, full_name, handle, tier")
            .eq("email", fallbackEmail)
            .maybeSingle();
          targetProfile = data || null;
        }

        if (targetProfile?.id) {
          const updatePayload: Record<string, any> = {
            updated_at: new Date().toISOString(),
          };

          if (tierFromMetadata === "artist" || tierFromMetadata === "label") {
            updatePayload.tier = tierFromMetadata;
          }


          if (couponCodeUsed) {
            updatePayload.first_month_coupon_used = true;
            updatePayload.first_month_coupon_used_at = new Date().toISOString();
            updatePayload.first_month_coupon_code = couponCodeUsed;
          }

          const { error: subUpdateError } = await supabase
            .from("profiles")
            .update(updatePayload)
            .eq("id", targetProfile.id);

          if (subUpdateError) {
            console.error("Supabase error updating subscription profile:", subUpdateError);
          }
        }

        const creatorEmail =
          targetProfile?.email ||
          session.customer_details?.email ||
          session.customer_email;

        const resolvedTier =
          tierFromMetadata === "artist" || tierFromMetadata === "label"
            ? tierFromMetadata
            : targetProfile?.tier || undefined;

        const resolvedHandle =
          customHandle || targetProfile?.handle || undefined;

        const resolvedName =
          targetProfile?.full_name ||
          targetProfile?.name ||
          session.customer_details?.name ||
          session.metadata?.fullName ||
          "";

        if (creatorEmail) {
          try {
            await syncCreatorToAweber({
              email: creatorEmail,
              name: resolvedName,
              tier: resolvedTier,
              handle: resolvedHandle,
            });
          } catch (aweberErr) {
            console.error("AWeber sync warning (subscription webhook):", aweberErr);
          }
        }
      }

      // -------------------------------------------------------------
      // CASE 2: Direct Store Asset Purchases (Single Tracks / Bundles)
      // -------------------------------------------------------------
      else if (session.mode === "payment") {
        const orderId = session.metadata?.orderId;
        const trackId = session.metadata?.trackId;
        const artistHandle = session.metadata?.artistHandle || session.metadata?.handle;
        const customerEmail = session.customer_email || session.customer_details?.email;
        const customerName = session.customer_details?.name || null;

        const totalCents = session.amount_total || 0;
        const grossAmount = totalCents / 100;

        // 1. Log Artist Earnings immediately so DirectBalanceButton updates live!
        if (artistHandle && grossAmount > 0) {
          const { data: artistProfile } = await supabase
            .from("profiles")
            .select("tier")
            .or(`handle.eq.${artistHandle},artist_handle.eq.${artistHandle}`)
            .maybeSingle();

          // Free = 15%, Paid Artist = 10%, Label = 5%
          const commissionRate = getTierCommissionRate(artistProfile?.tier);
          const platformFee = Number((grossAmount * commissionRate).toFixed(2));
          const netAmount = Number((grossAmount - platformFee).toFixed(2));

          const { error: earningsError } = await supabase
            .from("artist_earnings")
            .insert({
              artist_handle: artistHandle.toLowerCase(),
              stripe_session_id: session.id,
              gross_amount: grossAmount,
              platform_fee: platformFee,
              net_amount: netAmount,
            });

          if (earningsError) {
            console.error("Supabase error logging artist earnings:", earningsError);
          }
        }

        // 2. If an orderId exists, complete order & generate download token
        if (orderId) {
          await supabase
            .from("orders")
            .update({
              status: "completed",
              stripe_payment_intent_id: session.payment_intent as string,
              customer_email: customerEmail,
              updated_at: new Date().toISOString(),
            })
            .eq("id", orderId);

          const token = crypto.randomUUID();
          const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

          await supabase.from("download_tokens").insert({
            order_id: orderId,
            token: token,
            expires_at: expiresAt,
            max_downloads: 5,
            download_count: 0,
          });
        }

        // 3. Log telemetry for Admin Dashboard
        await supabase.from("analytics_events_v2").insert([
          {
            event_type: "purchase_intent",
            track_id: trackId || null,
            visitor_id: customerEmail || "stripe_customer",
            metadata: { orderId: orderId || null, amount: session.amount_total, type: "track_purchase" },
            created_at: new Date().toISOString(),
          },
        ]);

                // 4. Automatically sync customer to AWeber buyer vault list
        if (customerEmail) {
          await syncCustomerToAWeber(customerEmail, customerName || "Music Market Buyer", trackId);
        }
      }
    }

    // -------------------------------------------------------------
    // CASE 3: Subscription Cancellation / Expiration -> Free Tier
    // -------------------------------------------------------------
    else if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const meta = subscription.metadata || {};
      const explicitProfileId = meta.profileId || meta.userId || null;
      const customHandle = (meta.customHandle || meta.handleName || meta.handle || "").trim();
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer?.id || null;

      let targetProfileId: string | null = explicitProfileId;

      if (!targetProfileId && customHandle) {
        const cleanHandle = customHandle.replace(/[,()]/g, "");
        if (cleanHandle) {
          const { data: handleProfile } = await supabase
            .from("profiles")
            .select("id")
            .or(`handle.ilike.${cleanHandle},artist_handle.ilike.${cleanHandle}`)
            .maybeSingle();
          if (handleProfile?.id) {
            targetProfileId = handleProfile.id;
          }
        }
      }

      if (!targetProfileId && customerId) {
        const customer = await stripe.customers.retrieve(customerId);
        if (customer && !("deleted" in customer) && customer.email) {
          const { data: emailProfile } = await supabase
            .from("profiles")
            .select("id")
            .ilike("email", customer.email.trim().toLowerCase())
            .maybeSingle();
          if (emailProfile?.id) {
            targetProfileId = emailProfile.id;
          }
        }
      }

      if (targetProfileId) {
        const { error: downgradeError } = await supabase
          .from("profiles")
          .update({
            tier: "free",
            updated_at: new Date().toISOString(),
          })
          .eq("id", targetProfileId);

        if (downgradeError) {
          console.error("Supabase error downgrading profile on subscription delete:", downgradeError);
        }
      }
    }

    return NextResponse.json({ received: true });

  } catch (err: any) {
    console.error("Unhandled Stripe webhook error:", err);
    return NextResponse.json(
      { error: err?.message || "Webhook handler failed" },
      { status: 500 }
    );
  }
}
