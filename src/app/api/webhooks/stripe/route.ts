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
        const albumName = session.metadata?.albumName || "";
        const artistHandle = session.metadata?.artistHandle || session.metadata?.handle;
        const rawCustomerEmail =
          session.customer_details?.email || session.customer_email || "";
        const customerEmail = rawCustomerEmail.trim().toLowerCase() || null;
        const customerName = session.customer_details?.name || null;

        let parsedTrackIds: string[] = [];
        if (session.metadata?.trackIds) {
          try {
            const arr = JSON.parse(session.metadata.trackIds);
            if (Array.isArray(arr)) parsedTrackIds = arr.map(String).filter(Boolean);
          } catch {
            parsedTrackIds = [];
          }
        }
        if (parsedTrackIds.length === 0 && trackId) {
          parsedTrackIds = [String(trackId)];
        }

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

        // 2. Record PAID order & order_items so the Customer Download Vault finds the purchase
        if (customerEmail) {
          let resolvedOrderId = orderId || null;

          if (resolvedOrderId) {
            await supabase
              .from("orders")
              .update({
                status: "PAID",
                stripe_payment_intent_id:
                  typeof session.payment_intent === "string"
                    ? session.payment_intent
                    : session.payment_intent?.id || null,
                customer_email: customerEmail,
                updated_at: new Date().toISOString(),
              })
              .eq("id", resolvedOrderId);
          } else {
            const { data: createdOrder, error: orderInsertError } = await supabase
              .from("orders")
              .insert({
                customer_email: customerEmail,
                status: "PAID",
                stripe_session_id: session.id,
                stripe_payment_intent_id:
                  typeof session.payment_intent === "string"
                    ? session.payment_intent
                    : session.payment_intent?.id || null,
                total_amount: grossAmount,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .select("id")
              .maybeSingle();

            if (orderInsertError) {
              console.error("Supabase error creating PAID order:", orderInsertError);
            } else {
              resolvedOrderId = createdOrder?.id || null;
            }
          }

          if (resolvedOrderId) {
            let itemTrackIds = [...parsedTrackIds];

            if (itemTrackIds.length === 0 && albumName) {
              const { data: albumTracks } = await supabase
                .from("tracks_pro")
                .select("id, album_name")
                .is("deleted_at", null);

              itemTrackIds = (albumTracks || [])
                .filter((t) =>
                  t.album_name
                    ?.split(",")
                    .map((s: string) => s.trim().toLowerCase())
                    .includes(albumName.trim().toLowerCase())
                )
                .map((t) => String(t.id));
            }

            if (itemTrackIds.length > 0) {
              const { error: itemsError } = await supabase.from("order_items").insert(
                itemTrackIds.map((tId) => ({
                  order_id: resolvedOrderId,
                  track_id: tId,
                }))
              );
              if (itemsError) {
                console.error("Supabase error inserting order_items:", itemsError);
              }
            }
          }
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
