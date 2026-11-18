import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    // 1. Fetch total sales revenue from completed store orders
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("total_amount_in_cents, created_at")
      .eq("status", "completed");

    if (ordersError) throw ordersError;

    const totalRevenueInCents = orders.reduce(
      (sum, order) => sum + (order.total_amount_in_cents || 0),
      0
    );

    // 2. Fetch subscriber counts broken down by tier
    const { data: subscribers, error: subError } = await supabase
      .from("subscribers")
      .select("tier, status")
      .eq("status", "active");

    if (subError) throw subError;

    const subscriberCounts = {
      artist: subscribers.filter((s) => s.tier === "artist").length,
      label: subscribers.filter((s) => s.tier === "label").length,
      total: subscribers.length,
    };

    // 3. Fetch stream counts & calculate estimated audio bandwidth
    const { data: streams, error: streamsError } = await supabase
      .from("stream_logs")
      .select("duration_seconds, created_at");

    if (streamsError && streamsError.code !== "PGRST116") {
      // Ignore if table hasn't logged streams yet, default to empty
      console.warn("Stream logs query warning:", streamsError);
    }

    const streamList = streams || [];
    const totalStreams = streamList.length;

    // Estimate bandwidth based on ~320kbps audio bitrate (0.04 MB per second streamed)
    const totalSecondsStreamed = streamList.reduce(
      (acc, s) => acc + (s.duration_seconds || 0),
      0
    );
    const estimatedBandwidthMB = Math.round((totalSecondsStreamed * 0.04) * 100) / 100;

    return NextResponse.json({
      metrics: {
        totalRevenueUSD: (totalRevenueInCents / 100).toFixed(2),
        subscribers: subscriberCounts,
        totalStreams,
        estimatedBandwidthMB,
        totalBandwidthGB: (estimatedBandwidthMB / 1024).toFixed(2),
      },
      recentOrders: orders.slice(-10).reverse(), // Last 10 completed sales
    });
  } catch (error: any) {
    console.error("Error fetching analytics metrics:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load admin analytics" },
      { status: 500 }
    );
  }
}