// Demo data for the portfolio build.
//
// The live backend is paused to save costs. When the health check reports the
// backend offline, the API client (see ./api.ts) serves this sample data so the
// whole experience — dashboard, AI store calls, transcripts and online deals —
// stays explorable. New queries typed in the UI are simulated end-to-end.

import type {
  DashboardStats,
  OptionItem,
  OptionsResponse,
  StoreCall,
  TicketListItem,
  TicketRequest,
  TicketResponse,
  TicketStatus,
  TranscriptMessage,
  WebDeal,
} from "./api";

// ── time helpers ────────────────────────────────────────────────────────────

const T = Date.now();
const minsAgo = (m: number) => new Date(T - m * 60_000).toISOString();

// ── builders ──────────────────────────────────────────────────────────────

function mkCall(
  p: Partial<StoreCall> & { id: number; store_name: string }
): StoreCall {
  return {
    id: p.id,
    store_id: p.store_id ?? p.id,
    bolna_call_id: p.bolna_call_id ?? `call_${p.id}`,
    status: p.status ?? "analyzed",
    product_available: p.product_available ?? null,
    matched_product: p.matched_product ?? null,
    price: p.price ?? null,
    delivery_available: p.delivery_available ?? null,
    delivery_eta: p.delivery_eta ?? null,
    delivery_mode: p.delivery_mode ?? null,
    delivery_charge: p.delivery_charge ?? null,
    product_match_type: p.product_match_type ?? null,
    notes: p.notes ?? null,
    call_analysis: p.call_analysis ?? null,
    store_name: p.store_name,
    phone_number: p.phone_number ?? null,
    rating: p.rating ?? null,
    address: p.address ?? null,
    transcript: p.transcript ?? null,
    transcript_json: p.transcript_json ?? null,
  };
}

const summary = (s: string) => ({ call_summary: s });

interface Bundle {
  list: TicketListItem;
  status: TicketStatus;
  options?: OptionsResponse;
  active?: boolean;
}

// ════════════════════════════════════════════════════════════════════════════
// TKT-1042 — Prestige pressure cooker (Indiranagar) — completed, 3 of 4 found
// ════════════════════════════════════════════════════════════════════════════

const t1042_calls: StoreCall[] = [
  mkCall({
    id: 4201,
    store_name: "Prestige Smart Kitchen — 100 Feet Road",
    phone_number: "+91 80 4112 8890",
    rating: 4.5,
    address: "100 Feet Rd, Indiranagar, Bengaluru 560038",
    status: "analyzed",
    product_available: true,
    matched_product: "Prestige Deluxe Alpha 2L Stainless Steel",
    price: 1899,
    delivery_available: true,
    delivery_eta: "~2 hours",
    delivery_charge: 0,
    product_match_type: "exact",
    call_analysis: summary(
      "Confirmed Prestige Deluxe Alpha 2L stainless steel in stock at ₹1,899 with free 2-hour local delivery."
    ),
    transcript_json: [
      { role: "assistant", content: "Hi, am I speaking with Prestige Smart Kitchen on 100 Feet Road?" },
      { role: "user", content: "Yes, this is Prestige Smart Kitchen. How can I help you?" },
      { role: "assistant", content: "I'm calling on behalf of a customer looking for a 2 litre Prestige stainless steel pressure cooker. Do you have one in stock?" },
      { role: "user", content: "Yes, we have the Prestige Deluxe Alpha two litre stainless steel model in stock right now." },
      { role: "assistant", content: "Great. What's the price, and do you deliver to Indiranagar?" },
      { role: "user", content: "It's eighteen ninety-nine. We deliver within Indiranagar in about two hours, and delivery is free above fifteen hundred rupees." },
      { role: "assistant", content: "Perfect — I'll pass that on to the customer. Thank you so much!" },
    ],
  }),
  mkCall({
    id: 4202,
    store_name: "Reliance Digital — Indiranagar",
    phone_number: "+91 80 4096 5544",
    rating: 4.2,
    address: "CMH Rd, Indiranagar, Bengaluru 560038",
    status: "analyzed",
    product_available: true,
    matched_product: "Prestige Nakshatra Plus 2L Aluminium",
    price: 1949,
    delivery_available: true,
    delivery_eta: "Same day",
    delivery_charge: 49,
    product_match_type: "exact",
    call_analysis: summary(
      "Has Prestige Nakshatra Plus 2L at ₹1,949, same-day delivery for a ₹49 fee."
    ),
    transcript_json: [
      { role: "assistant", content: "Hello, is this Reliance Digital in Indiranagar?" },
      { role: "user", content: "Yes it is. Tell me what you need." },
      { role: "assistant", content: "Looking for a 2 litre Prestige pressure cooker — is it available?" },
      { role: "user", content: "We have the Prestige Nakshatra Plus two litre. Price is nineteen forty-nine." },
      { role: "assistant", content: "Do you offer delivery?" },
      { role: "user", content: "Yes, same-day delivery, forty-nine rupees charge for your area." },
      { role: "assistant", content: "Understood, thank you for the details." },
    ],
  }),
  mkCall({
    id: 4203,
    store_name: "Vijay Sales — Indiranagar",
    phone_number: "+91 80 2520 1188",
    rating: 4.3,
    address: "Old Madras Rd, Indiranagar, Bengaluru 560038",
    status: "analyzed",
    product_available: true,
    matched_product: "Prestige Svachh 3L (closest match)",
    price: 2150,
    delivery_available: false,
    delivery_eta: null,
    product_match_type: "close",
    call_analysis: summary(
      "No 2L in stock; offered the 3L Prestige Svachh at ₹2,150, pickup only."
    ),
    transcript_json: [
      { role: "assistant", content: "Hi, am I through to Vijay Sales Indiranagar?" },
      { role: "user", content: "Yes, speaking." },
      { role: "assistant", content: "Do you have a 2 litre Prestige pressure cooker in stock?" },
      { role: "user", content: "Two litre is out of stock currently. We have the three litre Prestige Svachh model though." },
      { role: "assistant", content: "What's the price on the 3 litre, and is delivery available?" },
      { role: "user", content: "Twenty-one fifty. Delivery not available right now, it's store pickup only." },
      { role: "assistant", content: "Got it, thanks for letting me know." },
    ],
  }),
  mkCall({
    id: 4204,
    store_name: "Anand Home Appliances",
    phone_number: "+91 80 2521 7766",
    rating: 4.0,
    address: "Jeevan Bima Nagar, Bengaluru 560075",
    status: "analyzed",
    product_available: false,
    product_match_type: "no_data",
    call_analysis: summary("Out of stock on all Prestige pressure cookers."),
    transcript_json: [
      { role: "assistant", content: "Hello, is this Anand Home Appliances?" },
      { role: "user", content: "Yes." },
      { role: "assistant", content: "Do you have a 2 litre Prestige pressure cooker?" },
      { role: "user", content: "Sorry, Prestige cookers are out of stock right now. Stock coming next week." },
      { role: "assistant", content: "No problem, thank you." },
    ],
  }),
];

const t1042_deals: WebDeal[] = [
  { platform: "Amazon", product_title: "Prestige Deluxe Alpha 2L Stainless Steel Pressure Cooker", price: 1799, original_price: 1999, discount_percent: 10, url: "https://www.amazon.in", offer_details: "10% off + ₹100 bank cashback", delivery_estimate: "Tomorrow", in_stock: true, why_notable: "Cheapest verified listing with fast delivery" },
  { platform: "Flipkart", product_title: "Prestige Nakshatra Plus 2L Aluminium", price: 1849, original_price: 2095, discount_percent: 12, url: "https://www.flipkart.com", offer_details: "12% off", delivery_estimate: "2 days", in_stock: true },
  { platform: "Prestige Official", product_title: "Deluxe Alpha 2.0L", price: 1999, url: "https://www.ttkprestige.com", delivery_estimate: "3-4 days", in_stock: true, why_notable: "Full manufacturer warranty" },
  { platform: "Croma", product_title: "Prestige Popular Plus 2L", price: 1899, url: "https://www.croma.com", delivery_estimate: "2-3 days", in_stock: true },
];

const t1042_options: OptionItem[] = [
  { rank: 1, store_name: "Prestige Smart Kitchen — 100 Feet Road", address: "100 Feet Rd, Indiranagar, Bengaluru 560038", phone_number: "+91 80 4112 8890", rating: 4.5, matched_product: "Prestige Deluxe Alpha 2L Stainless Steel", price: 1899, product_match_type: "exact", delivery_available: true, delivery_eta: "~2 hours", delivery_charge: 0, call_summary: "Exact model in stock, free 2-hour local delivery — best overall." },
  { rank: 2, store_name: "Reliance Digital — Indiranagar", address: "CMH Rd, Indiranagar, Bengaluru 560038", phone_number: "+91 80 4096 5544", rating: 4.2, matched_product: "Prestige Nakshatra Plus 2L Aluminium", price: 1949, product_match_type: "exact", delivery_available: true, delivery_eta: "Same day", delivery_charge: 49, call_summary: "Exact match, same-day delivery for a small fee." },
  { rank: 3, store_name: "Vijay Sales — Indiranagar", address: "Old Madras Rd, Indiranagar, Bengaluru 560038", phone_number: "+91 80 2520 1188", rating: 4.3, matched_product: "Prestige Svachh 3L (closest match)", price: 2150, product_match_type: "close", delivery_available: false, call_summary: "Only a 3L available, pickup only — fallback option." },
];

const TKT_1042: Bundle = {
  list: { id: 1042, ticket_id: "TKT-1042", query: "2 litre Prestige pressure cooker", location: "Indiranagar, Bangalore", status: "completed", product_name: "Prestige 2L Pressure Cooker", total_calls: 4, available_count: 3, created_at: minsAgo(8), updated_at: minsAgo(5) },
  status: {
    ticket_id: "TKT-1042", status: "completed", query: "2 litre Prestige pressure cooker", location: "Indiranagar, Bangalore", user_phone: "+91 98860 12345", user_name: "Sathvik", created_at: minsAgo(8), updated_at: minsAgo(5),
    product: { product_name: "Prestige 2L Pressure Cooker" },
    store_calls: t1042_calls,
    progress: { stores_found: 4, calls_total: 4, calls_completed: 4, calls_in_progress: 0 },
    web_deals: { search_summary: "Found 4 verified online listings, cheapest at ₹1,799.", deals: t1042_deals, best_deal: { platform: "Amazon", price: 1799, reason: "Lowest verified price with next-day delivery" } },
  },
  options: {
    ticket_id: "TKT-1042", product_requested: "Prestige 2L Pressure Cooker", stores_contacted: 4, calls_connected: 4, options_found: 3, options: t1042_options,
    web_deals: t1042_deals, web_deals_summary: "Online prices range ₹1,799–₹1,999; Amazon is cheapest with next-day delivery.", web_deals_best: { platform: "Amazon", price: 1799, reason: "Lowest verified price with next-day delivery" },
    quick_verdict: "Best buy: Prestige Smart Kitchen at ₹1,899 with free 2-hour delivery — cheaper than driving out, and ₹100 above Amazon but available today.",
    message: "3 of 4 stores had a matching 2L Prestige cooker. The 100 Feet Road outlet is your best local pick with free same-day delivery; Amazon is ₹100 cheaper if you can wait until tomorrow.",
    status: "completed",
  },
};

// ════════════════════════════════════════════════════════════════════════════
// TKT-1041 — Sony WH-1000XM5 headphones (Koramangala) — completed, 2 of 4
// ════════════════════════════════════════════════════════════════════════════

const t1041_calls: StoreCall[] = [
  mkCall({
    id: 4101,
    store_name: "Croma — Koramangala",
    phone_number: "+91 80 6726 4400",
    rating: 4.4,
    address: "80 Feet Rd, 4th Block, Koramangala, Bengaluru 560034",
    status: "analyzed",
    product_available: true,
    matched_product: "Sony WH-1000XM5 (Black)",
    price: 26990,
    delivery_available: true,
    delivery_eta: "Tomorrow",
    delivery_charge: 0,
    product_match_type: "exact",
    call_analysis: summary("Sony WH-1000XM5 black in stock at ₹26,990, free next-day delivery."),
    transcript_json: [
      { role: "assistant", content: "Hi, is this Croma in Koramangala?" },
      { role: "user", content: "Yes, Croma Koramangala. How may I help?" },
      { role: "assistant", content: "Do you have the Sony WH-1000XM5 wireless headphones in stock?" },
      { role: "user", content: "Yes, we have them in black. Price is twenty-six thousand nine ninety." },
      { role: "assistant", content: "Is delivery available?" },
      { role: "user", content: "Free delivery by tomorrow if you order today." },
      { role: "assistant", content: "Excellent, thank you very much." },
    ],
  }),
  mkCall({
    id: 4102,
    store_name: "Sony Center — Koramangala",
    phone_number: "+91 80 4115 9090",
    rating: 4.6,
    address: "1st Block, Koramangala, Bengaluru 560034",
    status: "analyzed",
    product_available: true,
    matched_product: "Sony WH-1000XM5 (Silver)",
    price: 28990,
    delivery_available: false,
    product_match_type: "exact",
    call_analysis: summary("Authorised Sony Center has XM5 (silver) at MRP ₹28,990, pickup only, full warranty."),
    transcript_json: [
      { role: "assistant", content: "Hello, am I speaking with the Sony Center in Koramangala?" },
      { role: "user", content: "Yes, this is the Sony exclusive store." },
      { role: "assistant", content: "Do you stock the WH-1000XM5 headphones?" },
      { role: "user", content: "We do, in silver. It's at the official price, twenty-eight thousand nine ninety, with full Sony India warranty." },
      { role: "assistant", content: "Do you deliver?" },
      { role: "user", content: "No delivery, but you can collect from the store any time today." },
      { role: "assistant", content: "Thanks, noted." },
    ],
  }),
  mkCall({
    id: 4103,
    store_name: "Reliance Digital — Koramangala",
    phone_number: "+91 80 4096 7788",
    rating: 4.1,
    address: "5th Block, Koramangala, Bengaluru 560095",
    status: "analyzed",
    product_available: false,
    matched_product: "Sony WH-1000XM4 (older model)",
    price: 19990,
    product_match_type: "close",
    delivery_available: true,
    delivery_eta: "2 days",
    call_analysis: summary("No XM5; has the previous-gen XM4 at ₹19,990."),
    transcript_json: [
      { role: "assistant", content: "Hi, is this Reliance Digital Koramangala?" },
      { role: "user", content: "Yes." },
      { role: "assistant", content: "Do you have the Sony WH-1000XM5?" },
      { role: "user", content: "The XM5 is sold out. We have the older XM4 at nineteen thousand nine ninety." },
      { role: "assistant", content: "Understood, thank you." },
    ],
  }),
  mkCall({
    id: 4104,
    store_name: "Sangeetha Mobiles — Koramangala",
    phone_number: "+91 80 2553 1212",
    rating: 3.9,
    address: "6th Block, Koramangala, Bengaluru 560095",
    status: "failed",
    product_available: null,
    call_analysis: summary("No answer after multiple attempts."),
  }),
];

const t1041_deals: WebDeal[] = [
  { platform: "Amazon", product_title: "Sony WH-1000XM5 Wireless Noise Cancelling Headphones", price: 24990, original_price: 29990, discount_percent: 16, url: "https://www.amazon.in", offer_details: "16% off + no-cost EMI", delivery_estimate: "Tomorrow", in_stock: true, why_notable: "Best price across all sources" },
  { platform: "Flipkart", product_title: "Sony WH-1000XM5 (Black)", price: 25499, original_price: 29990, discount_percent: 15, url: "https://www.flipkart.com", delivery_estimate: "2 days", in_stock: true },
  { platform: "Sony India", product_title: "WH-1000XM5", price: 29990, url: "https://www.sony.co.in", delivery_estimate: "3-5 days", in_stock: true, why_notable: "Direct from manufacturer, full warranty" },
];

const t1041_options: OptionItem[] = [
  { rank: 1, store_name: "Croma — Koramangala", address: "80 Feet Rd, 4th Block, Koramangala, Bengaluru 560034", phone_number: "+91 80 6726 4400", rating: 4.4, matched_product: "Sony WH-1000XM5 (Black)", price: 26990, product_match_type: "exact", delivery_available: true, delivery_eta: "Tomorrow", delivery_charge: 0, call_summary: "Exact model, free next-day delivery — strongest local option." },
  { rank: 2, store_name: "Sony Center — Koramangala", address: "1st Block, Koramangala, Bengaluru 560034", phone_number: "+91 80 4115 9090", rating: 4.6, matched_product: "Sony WH-1000XM5 (Silver)", price: 28990, product_match_type: "exact", delivery_available: false, call_summary: "Authorised store, full warranty, pickup only — peace of mind for ₹2k more." },
];

const TKT_1041: Bundle = {
  list: { id: 1041, ticket_id: "TKT-1041", query: "Sony WH-1000XM5 headphones", location: "Koramangala, Bangalore", status: "completed", product_name: "Sony WH-1000XM5", total_calls: 4, available_count: 2, created_at: minsAgo(47), updated_at: minsAgo(43) },
  status: {
    ticket_id: "TKT-1041", status: "completed", query: "Sony WH-1000XM5 headphones", location: "Koramangala, Bangalore", user_phone: "+91 98860 12345", user_name: "Sathvik", created_at: minsAgo(47), updated_at: minsAgo(43),
    product: { product_name: "Sony WH-1000XM5" },
    store_calls: t1041_calls,
    progress: { stores_found: 4, calls_total: 4, calls_completed: 4, calls_in_progress: 0 },
    web_deals: { search_summary: "3 listings found; Amazon cheapest at ₹24,990.", deals: t1041_deals, best_deal: { platform: "Amazon", price: 24990, reason: "₹2,000 below the cheapest store" } },
  },
  options: {
    ticket_id: "TKT-1041", product_requested: "Sony WH-1000XM5", stores_contacted: 4, calls_connected: 3, options_found: 2, options: t1041_options,
    web_deals: t1041_deals, web_deals_summary: "Online ₹24,990–₹29,990. Amazon undercuts every local store by ₹2,000+.", web_deals_best: { platform: "Amazon", price: 24990, reason: "₹2,000 below the cheapest store" },
    quick_verdict: "If you want it today, Croma at ₹26,990 with free delivery wins. If you can wait a day, Amazon saves you ₹2,000.",
    message: "2 of 4 stores had the XM5 in stock. Croma is the best in-store option; Amazon is meaningfully cheaper online if next-day delivery is fine.",
    status: "completed",
  },
};

// ════════════════════════════════════════════════════════════════════════════
// TKT-1039 — Yonex Astrox 88D Pro racket (Jayanagar) — completed, 1 of 3 (niche)
// ════════════════════════════════════════════════════════════════════════════

const t1039_calls: StoreCall[] = [
  mkCall({
    id: 3901,
    store_name: "Pro Sports Arena — Jayanagar",
    phone_number: "+91 80 2663 4521",
    rating: 4.7,
    address: "11th Main, 4th Block, Jayanagar, Bengaluru 560011",
    status: "analyzed",
    product_available: true,
    matched_product: "Yonex Astrox 88D Pro (2024)",
    price: 17500,
    delivery_available: true,
    delivery_eta: "Next day",
    delivery_charge: 0,
    product_match_type: "exact",
    call_analysis: summary("Specialist sports store has the exact Astrox 88D Pro at ₹17,500, free next-day delivery, will string for free."),
    transcript_json: [
      { role: "assistant", content: "Hi, is this Pro Sports Arena in Jayanagar?" },
      { role: "user", content: "Yes, badminton and racket sports specialist. Go ahead." },
      { role: "assistant", content: "Do you stock the Yonex Astrox 88D Pro?" },
      { role: "user", content: "Yes, the 2024 edition. Seventeen thousand five hundred. We'll string it free with your choice of tension." },
      { role: "assistant", content: "Delivery available?" },
      { role: "user", content: "Free next-day delivery anywhere in Bangalore." },
      { role: "assistant", content: "Wonderful, thank you!" },
    ],
  }),
  mkCall({
    id: 3902,
    store_name: "Decathlon — Jayanagar",
    phone_number: "+91 80 6191 2200",
    rating: 4.3,
    address: "Jayanagar 9th Block, Bengaluru 560069",
    status: "analyzed",
    product_available: false,
    product_match_type: "no_data",
    call_analysis: summary("Carries own Artengo brand only; no Yonex Astrox line."),
    transcript_json: [
      { role: "assistant", content: "Hello, is this Decathlon Jayanagar?" },
      { role: "user", content: "Yes." },
      { role: "assistant", content: "Do you have the Yonex Astrox 88D Pro racket?" },
      { role: "user", content: "We only stock our own Artengo rackets, no Yonex here." },
      { role: "assistant", content: "Got it, thanks." },
    ],
  }),
  mkCall({
    id: 3903,
    store_name: "Khelo Sports House",
    phone_number: "+91 80 2654 9988",
    rating: 4.0,
    address: "South End Circle, Bengaluru 560004",
    status: "failed",
    product_available: null,
    call_analysis: summary("Line busy / no answer."),
  }),
];

const t1039_deals: WebDeal[] = [
  { platform: "Amazon", product_title: "Yonex Astrox 88D Pro Badminton Racket (Unstrung)", price: 16499, original_price: 19990, discount_percent: 17, url: "https://www.amazon.in", delivery_estimate: "2 days", in_stock: true, why_notable: "Cheapest, but unstrung" },
  { platform: "Yonex Official", product_title: "Astrox 88D Pro 2024", price: 18900, url: "https://www.yonex.com", delivery_estimate: "4-6 days", in_stock: true, why_notable: "Guaranteed genuine" },
];

const TKT_1039: Bundle = {
  list: { id: 1039, ticket_id: "TKT-1039", query: "Yonex Astrox 88D Pro badminton racket", location: "Jayanagar, Bangalore", status: "completed", product_name: "Yonex Astrox 88D Pro", total_calls: 3, available_count: 1, created_at: minsAgo(95), updated_at: minsAgo(90) },
  status: {
    ticket_id: "TKT-1039", status: "completed", query: "Yonex Astrox 88D Pro badminton racket", location: "Jayanagar, Bangalore", user_phone: "+91 98860 12345", user_name: "Sathvik", created_at: minsAgo(95), updated_at: minsAgo(90),
    product: { product_name: "Yonex Astrox 88D Pro" },
    store_calls: t1039_calls,
    progress: { stores_found: 3, calls_total: 3, calls_completed: 3, calls_in_progress: 0 },
    web_deals: { search_summary: "2 online listings; Amazon cheapest but unstrung.", deals: t1039_deals, best_deal: { platform: "Pro Sports Arena", reason: "Free stringing offsets the higher price" } },
  },
  options: {
    ticket_id: "TKT-1039", product_requested: "Yonex Astrox 88D Pro", stores_contacted: 3, calls_connected: 2, options_found: 1, options: [
      { rank: 1, store_name: "Pro Sports Arena — Jayanagar", address: "11th Main, 4th Block, Jayanagar, Bengaluru 560011", phone_number: "+91 80 2663 4521", rating: 4.7, matched_product: "Yonex Astrox 88D Pro (2024)", price: 17500, product_match_type: "exact", delivery_available: true, delivery_eta: "Next day", delivery_charge: 0, call_summary: "Exact racket, free professional stringing, free next-day delivery — clear winner for a niche item." },
    ],
    web_deals: t1039_deals, web_deals_summary: "Amazon is ₹1,000 cheaper but ships unstrung; the local specialist strings it free.", web_deals_best: { platform: "Pro Sports Arena", reason: "Free stringing offsets the higher price" },
    quick_verdict: "Go with Pro Sports Arena — for a racket, free professional stringing is worth more than the ₹1,000 Amazon saving.",
    message: "Only the specialist store had this niche racket. Two big-box shops didn't carry the Yonex Astrox line at all.",
    status: "completed",
  },
};

// ════════════════════════════════════════════════════════════════════════════
// TKT-1038 — iPhone 15 Pro 256GB (Whitefield) — ACTIVE / live simulation
// ════════════════════════════════════════════════════════════════════════════

const t1038_calls: StoreCall[] = [
  mkCall({
    id: 3801,
    store_name: "iPlanet Apple Premium Reseller — Whitefield",
    phone_number: "+91 80 4567 1100",
    rating: 4.5,
    address: "Phoenix Marketcity, Whitefield, Bengaluru 560048",
    status: "analyzed",
    product_available: true,
    matched_product: "iPhone 15 Pro 256GB Natural Titanium",
    price: 134900,
    delivery_available: true,
    delivery_eta: "Same day",
    delivery_charge: 0,
    product_match_type: "exact",
    call_analysis: summary("Apple Premium Reseller has the exact 256GB Natural Titanium at ₹1,34,900, free same-day delivery, no-cost EMI."),
    transcript_json: [
      { role: "assistant", content: "Hi, is this iPlanet at Phoenix Marketcity Whitefield?" },
      { role: "user", content: "Yes, Apple premium reseller. How can I help?" },
      { role: "assistant", content: "Do you have the iPhone 15 Pro, 256GB, in Natural Titanium?" },
      { role: "user", content: "Yes, in stock. One thirty-four nine hundred, with no-cost EMI options." },
      { role: "assistant", content: "Delivery?" },
      { role: "user", content: "Free same-day delivery to Whitefield." },
      { role: "assistant", content: "Brilliant, thank you." },
    ],
  }),
  mkCall({
    id: 3802,
    store_name: "Croma — Phoenix Marketcity",
    phone_number: "+91 80 4096 3322",
    rating: 4.2,
    address: "Phoenix Marketcity, Whitefield, Bengaluru 560048",
    status: "analyzed",
    product_available: true,
    matched_product: "iPhone 15 Pro 256GB Blue Titanium",
    price: 134900,
    delivery_available: true,
    delivery_eta: "Tomorrow",
    delivery_charge: 0,
    product_match_type: "close",
    call_analysis: summary("Has 256GB in Blue Titanium (not Natural) at ₹1,34,900, plus ₹5,000 bank cashback."),
    transcript_json: [
      { role: "assistant", content: "Hello, Croma Phoenix Marketcity?" },
      { role: "user", content: "Yes." },
      { role: "assistant", content: "iPhone 15 Pro 256GB in Natural Titanium available?" },
      { role: "user", content: "Natural is sold out, but we have Blue Titanium 256GB. Same price, plus five thousand cashback on HDFC cards." },
      { role: "assistant", content: "Thanks, I'll mention the colour difference." },
    ],
  }),
  mkCall({
    id: 3803,
    store_name: "Reliance Digital — Whitefield",
    phone_number: "+91 80 4096 5511",
    rating: 4.0,
    address: "Forum Shantiniketan, Whitefield, Bengaluru 560048",
    status: "analyzed",
    product_available: false,
    product_match_type: "no_data",
    call_analysis: summary("256GB Pro out of stock; only the 128GB base variant available."),
    transcript_json: [
      { role: "assistant", content: "Hi, Reliance Digital Whitefield?" },
      { role: "user", content: "Yes, go ahead." },
      { role: "assistant", content: "iPhone 15 Pro 256GB Natural Titanium?" },
      { role: "user", content: "256GB is out. Only the 128GB Pro right now." },
      { role: "assistant", content: "Understood, thank you." },
    ],
  }),
  mkCall({
    id: 3804,
    store_name: "Sangeetha Mobiles — Whitefield",
    phone_number: "+91 80 2841 7799",
    rating: 3.8,
    address: "Whitefield Main Rd, Bengaluru 560066",
    status: "failed",
    product_available: null,
    call_analysis: summary("No answer."),
  }),
];

const t1038_deals: WebDeal[] = [
  { platform: "Amazon", product_title: "Apple iPhone 15 Pro 256GB Natural Titanium", price: 129999, original_price: 134900, discount_percent: 4, url: "https://www.amazon.in", offer_details: "₹5,000 instant bank discount", delivery_estimate: "Tomorrow", in_stock: true, why_notable: "Cheapest with instant bank discount" },
  { platform: "Flipkart", product_title: "iPhone 15 Pro (256GB)", price: 131900, url: "https://www.flipkart.com", delivery_estimate: "2 days", in_stock: true },
  { platform: "Apple Store", product_title: "iPhone 15 Pro 256GB", price: 134900, url: "https://www.apple.com/in", delivery_estimate: "3-4 days", in_stock: true, why_notable: "Free engraving, full warranty" },
];

const t1038_options: OptionItem[] = [
  { rank: 1, store_name: "iPlanet Apple Premium Reseller — Whitefield", address: "Phoenix Marketcity, Whitefield, Bengaluru 560048", phone_number: "+91 80 4567 1100", rating: 4.5, matched_product: "iPhone 15 Pro 256GB Natural Titanium", price: 134900, product_match_type: "exact", delivery_available: true, delivery_eta: "Same day", delivery_charge: 0, call_summary: "Exact colour & storage, free same-day delivery, no-cost EMI." },
  { rank: 2, store_name: "Croma — Phoenix Marketcity", address: "Phoenix Marketcity, Whitefield, Bengaluru 560048", phone_number: "+91 80 4096 3322", rating: 4.2, matched_product: "iPhone 15 Pro 256GB Blue Titanium", price: 134900, product_match_type: "close", delivery_available: true, delivery_eta: "Tomorrow", call_summary: "Same spec in Blue (not Natural), ₹5,000 card cashback effectively makes it cheapest in-store." },
];

const TKT_1038: Bundle = {
  active: true,
  list: { id: 1038, ticket_id: "TKT-1038", query: "iPhone 15 Pro 256GB Natural Titanium", location: "Whitefield, Bangalore", status: "calling_stores", product_name: "iPhone 15 Pro 256GB", total_calls: 4, available_count: 0, created_at: minsAgo(4), updated_at: minsAgo(1) },
  status: {
    ticket_id: "TKT-1038", status: "completed", query: "iPhone 15 Pro 256GB Natural Titanium", location: "Whitefield, Bangalore", user_phone: "+91 98860 12345", user_name: "Sathvik", created_at: minsAgo(4), updated_at: minsAgo(1),
    product: { product_name: "iPhone 15 Pro 256GB" },
    store_calls: t1038_calls,
    progress: { stores_found: 4, calls_total: 4, calls_completed: 4, calls_in_progress: 0 },
    web_deals: { search_summary: "3 listings; Amazon cheapest at ₹1,29,999 with bank discount.", deals: t1038_deals, best_deal: { platform: "Amazon", price: 129999, reason: "Cheapest with instant bank discount" } },
  },
  options: {
    ticket_id: "TKT-1038", product_requested: "iPhone 15 Pro 256GB", stores_contacted: 4, calls_connected: 3, options_found: 2, options: t1038_options,
    web_deals: t1038_deals, web_deals_summary: "Online ₹1,29,999–₹1,34,900. Amazon is ₹5,000 below store price with bank offer.", web_deals_best: { platform: "Amazon", price: 129999, reason: "Cheapest with instant bank discount" },
    quick_verdict: "For Natural Titanium today, iPlanet delivers same-day at list price. Amazon saves ₹5,000 if you can wait a day.",
    message: "2 of 4 stores had the 256GB Pro. iPlanet has the exact colour; Croma has it in Blue with a card discount.",
    status: "completed",
  },
};

// ════════════════════════════════════════════════════════════════════════════
// TKT-1036 — Samsung 1.5 ton inverter AC (HSR) — completed, 0 found (retry path)
// ════════════════════════════════════════════════════════════════════════════

const t1036_calls: StoreCall[] = [
  mkCall({
    id: 3601,
    store_name: "Girias — HSR Layout",
    phone_number: "+91 80 4123 6677",
    rating: 4.1,
    address: "27th Main, HSR Layout, Bengaluru 560102",
    status: "analyzed",
    product_available: false,
    product_match_type: "no_data",
    call_analysis: summary("1.5 ton 5-star Samsung inverter out of stock; restock expected in a week."),
    transcript_json: [
      { role: "assistant", content: "Hi, is this Girias HSR Layout?" },
      { role: "user", content: "Yes, speaking." },
      { role: "assistant", content: "Do you have a Samsung 1.5 ton 5-star inverter AC?" },
      { role: "user", content: "That model is out of stock. We're expecting it next week." },
      { role: "assistant", content: "Alright, thank you." },
    ],
  }),
  mkCall({
    id: 3602,
    store_name: "Bajaj Electronics — HSR",
    phone_number: "+91 80 4098 2244",
    rating: 4.0,
    address: "Sector 2, HSR Layout, Bengaluru 560102",
    status: "analyzed",
    product_available: false,
    matched_product: "Samsung 1.5 ton 3-star (different rating)",
    product_match_type: "close",
    call_analysis: summary("Only the 3-star variant available, not the 5-star the customer asked for."),
    transcript_json: [
      { role: "assistant", content: "Hello, Bajaj Electronics HSR?" },
      { role: "user", content: "Yes." },
      { role: "assistant", content: "Samsung 1.5 ton 5-star inverter AC available?" },
      { role: "user", content: "We have the 3-star, not the 5-star. The 5-star is back-ordered." },
      { role: "assistant", content: "Got it, thanks for checking." },
    ],
  }),
  mkCall({
    id: 3603,
    store_name: "Pai Electronics — HSR",
    phone_number: "+91 80 2572 8181",
    rating: 3.9,
    address: "Sector 1, HSR Layout, Bengaluru 560102",
    status: "failed",
    product_available: null,
    call_analysis: summary("No answer."),
  }),
];

const t1036_deals: WebDeal[] = [
  { platform: "Amazon", product_title: "Samsung 1.5 Ton 5 Star Inverter Split AC (2024)", price: 41990, original_price: 52990, discount_percent: 21, url: "https://www.amazon.in", offer_details: "21% off + free installation", delivery_estimate: "3 days", in_stock: true, why_notable: "Free installation, big discount" },
  { platform: "Flipkart", product_title: "Samsung 1.5 Ton 5 Star Inverter AC", price: 42499, url: "https://www.flipkart.com", delivery_estimate: "4 days", in_stock: true },
  { platform: "Samsung Shop", product_title: "1.5T 5-Star Inverter AC", price: 46990, url: "https://www.samsung.com/in", delivery_estimate: "5-7 days", in_stock: true, why_notable: "10-year compressor warranty" },
];

const TKT_1036: Bundle = {
  list: { id: 1036, ticket_id: "TKT-1036", query: "Samsung 1.5 ton 5-star inverter AC", location: "HSR Layout, Bangalore", status: "completed", product_name: "Samsung 1.5T 5-Star Inverter AC", total_calls: 3, available_count: 0, created_at: minsAgo(180), updated_at: minsAgo(174) },
  status: {
    ticket_id: "TKT-1036", status: "completed", query: "Samsung 1.5 ton 5-star inverter AC", location: "HSR Layout, Bangalore", user_phone: "+91 98860 12345", user_name: "Sathvik", created_at: minsAgo(180), updated_at: minsAgo(174),
    product: { product_name: "Samsung 1.5T 5-Star Inverter AC" },
    store_calls: t1036_calls,
    progress: { stores_found: 3, calls_total: 3, calls_completed: 3, calls_in_progress: 0 },
    web_deals: { search_summary: "Strong online stock; Amazon cheapest at ₹41,990 with free installation.", deals: t1036_deals, best_deal: { platform: "Amazon", price: 41990, reason: "Cheapest with free installation" } },
  },
  options: {
    ticket_id: "TKT-1036", product_requested: "Samsung 1.5T 5-Star Inverter AC", stores_contacted: 3, calls_connected: 2, options_found: 0, options: [],
    web_deals: t1036_deals, web_deals_summary: "Local stock is dry on the 5-star, but it's widely available online — Amazon has it at ₹41,990 with free installation.", web_deals_best: { platform: "Amazon", price: 41990, reason: "Cheapest with free installation" },
    quick_verdict: "No local store had the exact 5-star model — but Amazon has it at ₹41,990 with free installation, likely cheaper than any showroom.",
    message: "None of the 3 nearby stores had the 5-star variant in stock. Try increasing the store count, or order online where it's readily available.",
    status: "completed",
  },
};

// ════════════════════════════════════════════════════════════════════════════
// TKT-1035 — Cadbury Dairy Milk Silk gift pack (BTM) — completed, 2 of 3 (light)
// ════════════════════════════════════════════════════════════════════════════

const t1035_calls: StoreCall[] = [
  mkCall({
    id: 3501,
    store_name: "More Supermarket — BTM Layout",
    phone_number: "+91 80 4115 7733",
    rating: 4.2,
    address: "16th Main, BTM 2nd Stage, Bengaluru 560076",
    status: "analyzed",
    product_available: true,
    matched_product: "Dairy Milk Silk Celebration Gift Box",
    price: 545,
    delivery_available: true,
    delivery_eta: "45 mins",
    delivery_charge: 25,
    product_match_type: "exact",
    call_analysis: summary("Has the Silk Celebrations gift box at ₹545, 45-minute delivery for ₹25."),
    transcript_json: [
      { role: "assistant", content: "Hi, is this More Supermarket in BTM Layout?" },
      { role: "user", content: "Yes." },
      { role: "assistant", content: "Do you have the Cadbury Dairy Milk Silk gift pack?" },
      { role: "user", content: "Yes, the Silk Celebrations box. Five forty-five rupees." },
      { role: "assistant", content: "Delivery?" },
      { role: "user", content: "Forty-five minutes, twenty-five rupees delivery charge." },
      { role: "assistant", content: "Great, thanks!" },
    ],
  }),
  mkCall({
    id: 3502,
    store_name: "Spencer's — BTM",
    phone_number: "+91 80 2668 4422",
    rating: 4.0,
    address: "BTM 1st Stage, Bengaluru 560029",
    status: "analyzed",
    product_available: true,
    matched_product: "Dairy Milk Silk Gift Pack (5 bars)",
    price: 499,
    delivery_available: false,
    product_match_type: "close",
    call_analysis: summary("5-bar Silk gift pack at ₹499, pickup only."),
    transcript_json: [
      { role: "assistant", content: "Hello, Spencer's BTM?" },
      { role: "user", content: "Yes, go ahead." },
      { role: "assistant", content: "Cadbury Dairy Milk Silk gift pack available?" },
      { role: "user", content: "We have the five-bar gift pack, four ninety-nine. Store pickup only." },
      { role: "assistant", content: "Thank you." },
    ],
  }),
  mkCall({
    id: 3503,
    store_name: "Local Kirana Mart",
    phone_number: "+91 98451 22110",
    rating: 3.7,
    address: "BTM 2nd Stage, Bengaluru 560076",
    status: "analyzed",
    product_available: false,
    product_match_type: "no_data",
    call_analysis: summary("Only single Silk bars, no gift packs."),
    transcript_json: [
      { role: "assistant", content: "Hi, do you have Cadbury Silk gift packs?" },
      { role: "user", content: "Only single bars, no gift boxes." },
      { role: "assistant", content: "Okay, thanks." },
    ],
  }),
];

const t1035_deals: WebDeal[] = [
  { platform: "Blinkit", product_title: "Cadbury Dairy Milk Silk Celebrations Gift Box", price: 525, url: "https://blinkit.com", delivery_estimate: "12 mins", in_stock: true, why_notable: "Fastest delivery" },
  { platform: "Amazon", product_title: "Dairy Milk Silk Gift Pack", price: 489, original_price: 560, discount_percent: 13, url: "https://www.amazon.in", delivery_estimate: "Tomorrow", in_stock: true },
];

const TKT_1035: Bundle = {
  list: { id: 1035, ticket_id: "TKT-1035", query: "Cadbury Dairy Milk Silk gift pack", location: "BTM Layout, Bangalore", status: "completed", product_name: "Dairy Milk Silk Gift Pack", total_calls: 3, available_count: 2, created_at: minsAgo(320), updated_at: minsAgo(316) },
  status: {
    ticket_id: "TKT-1035", status: "completed", query: "Cadbury Dairy Milk Silk gift pack", location: "BTM Layout, Bangalore", user_phone: "+91 98860 12345", user_name: "Sathvik", created_at: minsAgo(320), updated_at: minsAgo(316),
    product: { product_name: "Dairy Milk Silk Gift Pack" },
    store_calls: t1035_calls,
    progress: { stores_found: 3, calls_total: 3, calls_completed: 3, calls_in_progress: 0 },
    web_deals: { search_summary: "Available on quick-commerce in minutes.", deals: t1035_deals, best_deal: { platform: "Blinkit", price: 525, reason: "12-minute delivery" } },
  },
  options: {
    ticket_id: "TKT-1035", product_requested: "Dairy Milk Silk Gift Pack", stores_contacted: 3, calls_connected: 3, options_found: 2, options: [
      { rank: 1, store_name: "More Supermarket — BTM Layout", address: "16th Main, BTM 2nd Stage, Bengaluru 560076", phone_number: "+91 80 4115 7733", rating: 4.2, matched_product: "Dairy Milk Silk Celebration Gift Box", price: 545, product_match_type: "exact", delivery_available: true, delivery_eta: "45 mins", delivery_charge: 25, call_summary: "Exact gift box with fast local delivery." },
      { rank: 2, store_name: "Spencer's — BTM", address: "BTM 1st Stage, Bengaluru 560029", phone_number: "+91 80 2668 4422", rating: 4.0, matched_product: "Dairy Milk Silk Gift Pack (5 bars)", price: 499, product_match_type: "close", delivery_available: false, call_summary: "Cheapest, but pickup only." },
    ],
    web_deals: t1035_deals, web_deals_summary: "Blinkit delivers in ~12 minutes; Amazon is cheapest if you can wait.", web_deals_best: { platform: "Blinkit", price: 525, reason: "12-minute delivery" },
    quick_verdict: "For a gift today, More Supermarket delivers the exact box in 45 minutes — or Blinkit in ~12 minutes online.",
    message: "2 of 3 stores had a Silk gift pack. Both quick-commerce apps also have it within minutes.",
    status: "completed",
  },
};

// ════════════════════════════════════════════════════════════════════════════
// TKT-1031 — Trekking shoes (Marathahalli) — FAILED (pipeline error)
// ════════════════════════════════════════════════════════════════════════════

const TKT_1031: Bundle = {
  list: { id: 1031, ticket_id: "TKT-1031", query: "Quechua MH100 trekking shoes size 9", location: "Marathahalli, Bangalore", status: "failed", product_name: "Quechua MH100 Trekking Shoes", total_calls: 0, available_count: 0, created_at: minsAgo(1500), updated_at: minsAgo(1498) },
  status: {
    ticket_id: "TKT-1031", status: "failed", query: "Quechua MH100 trekking shoes size 9", location: "Marathahalli, Bangalore", user_phone: "+91 98860 12345", user_name: "Sathvik", created_at: minsAgo(1500), updated_at: minsAgo(1498),
    product: { product_name: "Quechua MH100 Trekking Shoes" },
    error: "No stores with a listed phone number were found near Marathahalli for this query. Try a broader location or a more common product.",
    store_calls: [],
    progress: { stores_found: 0, calls_total: 0, calls_completed: 0, calls_in_progress: 0 },
  },
};

// ── registry ────────────────────────────────────────────────────────────────

const BUNDLES: Bundle[] = [
  TKT_1042,
  TKT_1041,
  TKT_1039,
  TKT_1038,
  TKT_1036,
  TKT_1035,
  TKT_1031,
];

export const DEMO_TICKET_LIST: TicketListItem[] = BUNDLES.map((b) => b.list);

const STATUS_BY_ID = new Map<string, TicketStatus>();
const OPTIONS_BY_ID = new Map<string, OptionsResponse>();
const ACTIVE_IDS = new Set<string>();
const advanced = new Set<string>();

for (const b of BUNDLES) {
  STATUS_BY_ID.set(b.status.ticket_id, b.status);
  if (b.options) OPTIONS_BY_ID.set(b.status.ticket_id, b.options);
  if (b.active) ACTIVE_IDS.add(b.status.ticket_id);
}

// ── dashboard stats ─────────────────────────────────────────────────────────

function buildHourly(): { hour: string; count: number }[] {
  const pattern = [0, 1, 0, 2, 1, 3, 2, 4, 3, 2, 5, 3, 4, 2];
  const out: { hour: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(T - i * 3_600_000);
    d.setMinutes(0, 0, 0);
    out.push({ hour: d.toISOString(), count: pattern[13 - i] });
  }
  return out;
}

export const DEMO_DASHBOARD_STATS: DashboardStats = {
  total_tickets: 7,
  status_counts: { completed: 5, failed: 1, calling_stores: 1 },
  total_calls: 21,
  call_outcomes: { available: 8, unavailable: 7, failed: 2, in_progress: 4 },
  stores_contacted: 21,
  hourly_activity: buildHourly(),
  completed: 5,
  failed: 1,
  in_progress: 1,
  products_found: 4,
  success_rate: 80,
};

// ── synthetic ticket generation (for new queries typed in the UI) ────────────

let syntheticSeq = 900;

function callingVersion(c: StoreCall): StoreCall {
  return {
    ...c,
    status: "calling",
    product_available: null,
    price: null,
    matched_product: null,
    delivery_available: null,
    delivery_eta: null,
    delivery_charge: null,
    product_match_type: null,
    notes: null,
    call_analysis: null,
    transcript: null,
    transcript_json: null,
  };
}

export function createDemoTicket(req: TicketRequest): TicketResponse {
  const n = Math.min(Math.max(req.max_stores ?? 4, 3), 4);
  const id = `TKT-${++syntheticSeq}`;
  const area = (req.location.split(",")[0] || "your area").trim();
  const product = req.query.trim();

  const blueprint: Array<{
    name: string;
    available: boolean;
    match: string;
    price?: number;
    delivery?: boolean;
    eta?: string;
    note: string;
  }> = [
    { name: `${area} Electronics & More`, available: true, match: "exact", price: 4990, delivery: true, eta: "Same day", note: `Confirmed "${product}" in stock with same-day delivery.` },
    { name: "Reliance Digital", available: true, match: "close", price: 5290, delivery: true, eta: "Tomorrow", note: `Has a closely matching variant of "${product}".` },
    { name: "Croma", available: true, match: "exact", price: 5150, delivery: false, note: `Exact match available, store pickup only.` },
    { name: `${area} City Store`, available: false, match: "no_data", note: "Out of stock currently." },
  ];

  const used = blueprint.slice(0, n);
  const calls: StoreCall[] = used.map((s, i) =>
    mkCall({
      id: syntheticSeq * 10 + i,
      store_name: s.name,
      phone_number: `+91 80 4${(1000 + i * 137).toString().slice(0, 3)} ${(2000 + i * 311).toString().slice(0, 4)}`,
      rating: Number((4 + ((i * 17) % 9) / 10).toFixed(1)),
      address: `${area}, Bengaluru`,
      status: s.available ? "analyzed" : i === n - 1 ? "analyzed" : "analyzed",
      product_available: s.available,
      matched_product: s.available ? `${product}` : null,
      price: s.price ?? null,
      delivery_available: s.available ? !!s.delivery : null,
      delivery_eta: s.eta ?? null,
      delivery_charge: s.delivery ? 0 : null,
      product_match_type: s.match,
      call_analysis: summary(s.note),
      transcript_json: [
        { role: "assistant", content: `Hi, am I speaking with ${s.name}?` },
        { role: "user", content: "Yes, how can I help you?" },
        { role: "assistant", content: `I'm calling on behalf of a customer looking for "${product}". Do you have it in stock?` },
        s.available
          ? { role: "user", content: `Yes, we have it${s.price ? `. The price is around ${s.price} rupees` : ""}.` }
          : { role: "user", content: "Sorry, that's out of stock at the moment." },
        s.available
          ? { role: "assistant", content: `Great${s.delivery ? `, and do you deliver?` : ". Thank you!"}` }
          : { role: "assistant", content: "No problem, thank you for checking." },
        ...(s.available && s.delivery
          ? [{ role: "user" as const, content: `Yes, ${s.eta?.toLowerCase()} delivery available.` }, { role: "assistant" as const, content: "Perfect, thanks so much!" }]
          : []),
      ] as TranscriptMessage[],
    })
  );

  const availableCalls = calls.filter((c) => c.product_available);
  const options: OptionItem[] = availableCalls
    .sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
    .map((c, i) => ({
      rank: i + 1,
      store_name: c.store_name,
      address: c.address ?? undefined,
      phone_number: c.phone_number ?? undefined,
      rating: c.rating ?? undefined,
      matched_product: c.matched_product ?? undefined,
      price: c.price ?? undefined,
      product_match_type: c.product_match_type ?? undefined,
      delivery_available: c.delivery_available ?? undefined,
      delivery_eta: c.delivery_eta ?? undefined,
      delivery_charge: c.delivery_charge ?? undefined,
      call_summary:
        (c.call_analysis as { call_summary?: string } | null)?.call_summary,
    }));

  const deals: WebDeal[] = [
    { platform: "Amazon", product_title: product, price: (options[0]?.price ?? 4990) - 300, original_price: (options[0]?.price ?? 4990) + 200, discount_percent: 10, url: "https://www.amazon.in", delivery_estimate: "Tomorrow", in_stock: true, why_notable: "Cheapest verified online listing" },
    { platform: "Flipkart", product_title: product, price: (options[0]?.price ?? 4990) - 150, url: "https://www.flipkart.com", delivery_estimate: "2 days", in_stock: true },
  ];

  const status: TicketStatus = {
    ticket_id: id,
    status: "completed",
    query: product,
    location: req.location,
    user_phone: req.user_phone,
    user_name: req.user_name,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    product: { product_name: product },
    store_calls: calls,
    progress: { stores_found: n, calls_total: n, calls_completed: n, calls_in_progress: 0 },
    web_deals: { search_summary: "Sample online deals.", deals, best_deal: { platform: "Amazon", price: deals[0].price, reason: "Cheapest verified online listing" } },
  };

  const optionsResp: OptionsResponse = {
    ticket_id: id,
    product_requested: product,
    stores_contacted: n,
    calls_connected: calls.filter((c) => c.status === "analyzed").length,
    options_found: options.length,
    options,
    web_deals: deals,
    web_deals_summary: "Online listings are typically a little cheaper but slower than local pickup.",
    web_deals_best: { platform: "Amazon", price: deals[0].price, reason: "Cheapest verified online listing" },
    quick_verdict:
      options.length > 0
        ? `Best pick: ${options[0].store_name}${options[0].price ? ` at ₹${options[0].price}` : ""}.`
        : "No local store had it in stock — check the online deals below.",
    message:
      options.length > 0
        ? `${options.length} of ${n} stores had a match for "${product}". (This is sample data — the live backend is paused.)`
        : `None of the ${n} nearby stores had "${product}" in stock. (Sample data.)`,
    status: "completed",
  };

  STATUS_BY_ID.set(id, status);
  OPTIONS_BY_ID.set(id, optionsResp);
  ACTIVE_IDS.add(id); // simulate the full pipeline on first subscribe

  return { ticket_id: id, status: "accepted", message: "Demo ticket created — simulating the pipeline." };
}

// ── accessors used by the API client ─────────────────────────────────────────

function fallbackStatus(ticketId: string): TicketStatus {
  return {
    ticket_id: ticketId,
    status: "completed",
    product: { product_name: ticketId },
    store_calls: [],
    progress: { stores_found: 0, calls_total: 0, calls_completed: 0, calls_in_progress: 0 },
  };
}

export function getDemoTicketStatus(ticketId: string): TicketStatus {
  const final = STATUS_BY_ID.get(ticketId);
  if (!final) return fallbackStatus(ticketId);
  if (final.status === "failed") return final;
  // An active ticket that hasn't finished its live simulation yet shows the
  // first "calling" frame; once advanced (or for already-completed tickets) it
  // returns the full completed snapshot.
  if (ACTIVE_IDS.has(ticketId) && !advanced.has(ticketId)) {
    return buildTimeline(final, { tailOnly: true })[0].snap;
  }
  return final;
}

export function getDemoOptions(ticketId: string): OptionsResponse {
  const opts = OPTIONS_BY_ID.get(ticketId);
  if (opts) return opts;
  return {
    ticket_id: ticketId,
    product_requested: ticketId,
    stores_contacted: 0,
    calls_connected: 0,
    options_found: 0,
    options: [],
    message: "No results available for this sample ticket.",
    status: "completed",
  };
}

// ── live pipeline simulation ──────────────────────────────────────────────────

function emptyProgress(): NonNullable<TicketStatus["progress"]> {
  return { stores_found: 0, calls_total: 0, calls_completed: 0, calls_in_progress: 0 };
}

function buildTimeline(
  final: TicketStatus,
  opts?: { tailOnly?: boolean }
): { delay: number; snap: TicketStatus }[] {
  const calls = final.store_calls ?? [];
  const n = calls.length;
  const deals = final.web_deals;
  const product = final.product;
  const callingCalls = calls.map(callingVersion);

  const snap = (
    status: string,
    store_calls: StoreCall[],
    progress: NonNullable<TicketStatus["progress"]>,
    withDeals: boolean
  ): TicketStatus => ({
    ...final,
    status,
    product: ["researching", "finding_stores", "calling_stores", "completed"].includes(status)
      ? product
      : undefined,
    store_calls,
    progress,
    web_deals: withDeals ? deals : undefined,
  });

  const out: { delay: number; snap: TicketStatus }[] = [];

  if (!opts?.tailOnly) {
    out.push({ delay: 0, snap: snap("received", [], emptyProgress(), false) });
    out.push({ delay: 700, snap: snap("analyzing", [], emptyProgress(), false) });
    out.push({ delay: 1900, snap: snap("researching", [], emptyProgress(), false) });
    out.push({ delay: 3100, snap: snap("finding_stores", [], { stores_found: n, calls_total: 0, calls_completed: 0, calls_in_progress: 0 }, false) });
  }

  const callStart = opts?.tailOnly ? 0 : 4300;
  out.push({
    delay: callStart,
    snap: snap("calling_stores", callingCalls, { stores_found: n, calls_total: n, calls_completed: 0, calls_in_progress: n }, true),
  });

  for (let i = 0; i < n; i++) {
    const revealed = calls.map((c, idx) => (idx <= i ? c : callingVersion(c)));
    const completed = i + 1;
    out.push({
      delay: callStart + 1100 + i * 1300,
      snap: snap("calling_stores", revealed, { stores_found: n, calls_total: n, calls_completed: completed, calls_in_progress: n - completed }, true),
    });
  }

  out.push({
    delay: callStart + 1100 + n * 1300 + 700,
    snap: snap("completed", calls, { stores_found: n, calls_total: n, calls_completed: n, calls_in_progress: 0 }, true),
  });

  return out;
}

export function simulateDemoTicket(
  ticketId: string,
  onUpdate: (s: TicketStatus) => void
): () => void {
  const final = STATUS_BY_ID.get(ticketId);
  if (!final || final.status === "failed") {
    const t = setTimeout(() => onUpdate(final ?? fallbackStatus(ticketId)), 200);
    return () => clearTimeout(t);
  }

  const tailOnly = ACTIVE_IDS.has(ticketId) && !advanced.has(ticketId);
  const timeline = buildTimeline(final, { tailOnly });
  let cancelled = false;
  const timers = timeline.map(({ delay, snap }) =>
    setTimeout(() => {
      if (cancelled) return;
      if (snap.status === "completed") advanced.add(ticketId);
      onUpdate(snap);
    }, delay)
  );
  return () => {
    cancelled = true;
    timers.forEach(clearTimeout);
  };
}
