/**
 * BasicPhrases: Pocket Phrasebook (the new look, Phrases.dc.html; plan S14).
 *
 * The mustard plate (PHRASEBOOK · SPANISH, "Say it in Spanish", the place in mono, PLANNING
 * when browsing elsewhere), one white language pill that opens a sheet with every option
 * (the country's language or the local dialect; in English-speaking places, English only
 * or a language to translate from), a search, and the situations: rows with a thumb-index
 * tab (stamp red for allergies and emergencies) that open into hairline phrase rows, each
 * with the meaning, the phrase in serif, a mustard speaker and how to say it.
 *
 * The data and audio are unchanged: preset English phrases, Supabase-seeded translations
 * then the AI fallback with its caches, the Neural2 TTS worker with the browser voice as
 * the last resort, the reverse mode (your language first, English to say) and English
 * only. No emoji, no flags; every type on mustard is the ink.
 *
 * TTS worker: https://globeskimmers-tts.maizasimeon.workers.dev
 */

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { legacyUser } from "@/lib/legacyUser";
import { invokeLLM } from "@/lib/callWorker";
import { supabase } from "@/lib/supabaseClient";
import {
  BedDouble, CarTaxiFront, Check, ChevronDown, Globe, Hash, Info, Languages, Map as MapIcon, MapPin, Search, SearchX,
  ShoppingBasket, Siren, Volume2, Wallet, WheatOff,
} from "lucide-react";
import { WORLD, NEUTRAL, fs } from "@/components/redesign/constants";
import { useLocation } from "../components/location/LocationContext";
import { getLocationLabel } from "@/components/location/locationLabel";
import LocationModePicker from "../components/location/LocationModePicker";
import FinderHeader, { finderColumnStyle } from "@/components/finder/FinderHeader";
import { WorldSearch, WorldNote } from "@/components/finder/FinderControls";
import { WorldSkeleton } from "@/components/finder/FinderCard";
import FinderEmptyState from "@/components/finder/FinderEmptyState";
import FilterSheet, { FilterGroupLabel } from "@/components/finder/FilterSheet";
import { ThumbIndex } from "@/components/finder/motifs";
import { useIsTablet } from "@/lib/useIsTablet";

const W = WORLD.phrases;
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const SERIF = "'Instrument Serif', Georgia, serif";

// ============================================================================
// CLOUDFLARE WORKER URL - Your TTS endpoint
// ============================================================================
// Use the standalone TTS worker (globeskimmers-tts): it serves the Neural2 audio
// AND the translation KV cache. The main `globeskimmers-api` worker has no /tts
// route, so the old URL 404'd every call → audio always fell back to the phone's
// browser voice (which can't speak Japanese/CJK in the in-app webview).
const CLOUDFLARE_TTS_URL = 'https://globeskimmers-tts.maizasimeon.workers.dev';

// ============================================================================
// PRESET PHRASES FROM YOUR WORD DOCUMENT
// These load INSTANTLY - no AI generation needed!
// ============================================================================
const PRESET_PHRASES = {
  basics: [
    // Greetings - Casual
    "Hi.",
    "Hey.",
    "Hello.",
    // Greetings - Standard
    "Good morning.",
    "Good afternoon.",
    "Good evening.",
    "Good night.",
    // Greetings - Formal
    "Good morning, sir/ma'am.",
    "Good afternoon, sir/ma'am.",
    "Good evening, sir/ma'am.",
    // Introductions
    "My name is __________.",
    "I am a/the __________.",
    "Nice to meet you.",
    "It is a pleasure to meet you.",
    // Wellbeing & Status
    "How are you?",
    "How are you doing?",
    "I am doing fine.",
    "I am well.",
    // Polite Expressions
    "Please.",
    "Thank you.",
    "Thanks.",
    "Thank you very much.",
    "I am very grateful.",
    "You're welcome.",
    // Apologies
    "Excuse me.",
    "Pardon me.",
    "I'm sorry.",
    "Please forgive me.",
    "I'm sorry to bother you.",
    // Asking for Help
    "Pardon me, could you help me, please?",
    "Excuse me, may I please ask a question?",
    "Could you please help me?",
    "I would greatly appreciate your assistance.",
    // Communication Assistance
    "Do you speak English?",
    "I am sorry, I don't understand.",
    "Could you please speak a little slower?",
    "Can you write that down for me?",
    "How do you say [pointing to object] in your language?",
    // Farewells - Casual
    "Goodbye.",
    "See you later.",
    // Farewells - Standard
    "Have a nice day.",
    "Have a great week.",
    // Farewells - Formal
    "Have a wonderful day.",
    "Have a pleasant evening.",
    "Goodbye, and thank you again."
  ],
  directions: [
    "Excuse me, where is the nearest [Bank/Pharmacy/Restroom]?",
    "Could you please show me on the map?",
    "How far is it to [Destination]?",
    "Is it within walking distance?",
    "I am looking for this address: [Address].",
    "Which street is this?",
    "Is this the correct way to [Landmark]?",
    "Do I need to turn left or right here?",
    "Is this open today? What time does it close?",
    "I want to ___________",
    "I'm looking for ____________",
    "Do you know where ______________ is?",
    "Do you know where I can buy ______________?",
    "Do you know where I can find _____________?",
    "Do you know where the nearest ______________ is?"
  ],
  transportation: [
    "To the airport/train station/port, please.",
    "How much is the fare to [Destination]?",
    "Please stop here. Thank you.",
    "Where can I buy a ticket for the bus/train?",
    "Does this bus/train go to [Destination]?",
    "How long until the next bus/train arrives?",
    "Please tell me when we arrive at [Landmark].",
    "I need a ride service to [Location].",
    "Which platform/gate is for [Destination]?",
    "Is this seat taken? May I sit here?",
    "Is this where _________________ is?",
    "Please take me to ______________?",
    "Is there parking here/there?",
    "Do you know where I can park here?",
    "Do you know where the nearest parking is?",
    "Am I allowed to park here?",
    "How much is the parking fee?"
  ],
  accommodation: [
    "I have a reservation under [Name].",
    "Could I please have the Wi-Fi password?",
    "The [A/C/heater/faucet] is not working. Could someone fix it?",
    "Could I please have extra towels/pillows/blankets?",
    "What time is breakfast/dinner served?",
    "What time is check-out tomorrow?",
    "Could you please call me a taxi for [Time] tomorrow morning?",
    "I have a problem with my room key/card.",
    "Where is the [restaurant/lobby/exit]?",
    "Is there a laundry service available?",
    "Do you have WIFI here?",
    "Can I use your WIFI?",
    "How much is WIFI and for how long?",
    "Do you have a gym here?",
    "Is there a pool here?",
    "Do you have a pool here?",
    "Is there beach access here?",
    "Is parking included?",
    "Do you have parking here?",
    "What time is the _________ open and closed?",
    "Do you have a wake up call service?",
    "Do you have room service?",
    "May I request for another room key please?",
    "Is there vending machine here?",
    "Is there a microwave?",
    "Is there a microwave in the room?",
    "Is there a fridge in the room?",
    "Is there an accessible bathroom (that has bars and wheeled chair accessible)?"
  ],
  shopping: [
    "How much does this cost?",
    "Could you please show me the total price?",
    "I would like to buy [specific item], please.",
    "Do you accept [Visa/MasterCard/Amex]?",
    "Do you accept Apple Pay or Google Pay?",
    "Do you take cash?",
    "Is it possible to pay with cash and card?",
    "I need to buy [water/toothpaste/phone charger].",
    "Where is the nearest ATM/cash machine?",
    "I would like to exchange money.",
    "Could I please see the receipt?",
    "Is there a discount or a sale price for this?",
    "Can I try this on, please?"
  ],
  grocery: [
    // Grains, Dairy & Staples
    "Rice", "Bread", "Milk", "Cheese", "Butter", "Eggs", "Yogurt", "Cream",
    "Pasta", "Noodles", "Flour", "Cornmeal", "Oats / Oatmeal", "Tortilla",
    "Potato", "Sweet Potato", "Breakfast cereal", "Crackers",
    // Meat, Seafood & Protein
    "Chicken", "Beef", "Pork", "Fish", "Shrimp", "Seafood mix", "Crab",
    "Salmon", "Tuna", "Steak", "Pork chop", "Ground beef", "Sausage",
    "Ham", "Bacon", "Turkey", "Lamb", "Tofu", "Tempeh",
    // Condiments, Sauces & Oils
    "Ketchup", "Mustard", "Mayo", "Salt", "Pepper", "Sugar", "Vinegar",
    "Soy sauce", "Hot sauce", "Chili paste", "BBQ sauce", "Salad dressing",
    "Olive oil", "Vegetable oil", "Sesame oil", "Butter / Margarine",
    "Honey", "Jam / Jelly", "Peanut butter",
    // Vegetables
    "Lettuce", "Cabbage", "Spinach", "Kale", "Tomato", "Garlic", "Onion",
    "Bell pepper", "Chili pepper", "Corn", "Carrot", "Celery", "Ginger",
    "Cilantro", "Basil", "Parsley", "Broccoli", "Cauliflower", "Green beans",
    "Mushrooms", "Zucchini", "Eggplant", "Cucumber", "Avocado",
    // Fruits
    "Banana", "Apple", "Orange", "Pineapple", "Mango", "Grapes",
    "Lemon", "Lime", "Strawberry", "Blueberry", "Watermelon", "Papaya", "Kiwi",
    // Beverages
    "Ice", "Ice water", "Water bottle", "Soft drinks", "Juice", "Coffee",
    "Tea", "Milk tea", "Beer", "Wine", "Sparkling water",
    // Taste & Texture Descriptors
    "Sweet", "Sour", "Spicy", "Mild", "Salty", "Savory", "Umami",
    "Bitter", "Tart", "Fresh", "Crispy", "Crunchy", "Soft", "Chewy", "Creamy",
    // Cooking Essentials
    "Cooking oil", "Garlic powder", "Onion powder", "Chili flakes",
    "Curry powder", "Baking soda", "Baking powder", "Brown sugar",
    "Oyster sauce", "Fish sauce", "Tomato sauce / Tomato paste", "Broth / Soup base",
    // Everyday Essentials
    "Bottled water", "Instant noodles", "Rice cooker rice packs", "Sandwich bread",
    "Pre-cut fruit", "Salad kits", "Snacks (chips, crackers, nuts)", "Cookies",
    "Chocolate", "Yogurt cups", "Milk cartons", "Instant coffee", "Tea bags",
    "Dish soap", "Paper towels", "Napkins", "Trash bags"
  ],
  allergies: [
    "I have a severe allergy to [Allergen: e.g., Peanuts/Gluten/Shellfish].",
    "Please ensure this dish contains absolutely no [Allergen].",
    "Please remove [my allergen] from this dish.",
    "I want to double-check and make sure that there is no [my allergen] in this dish.",
    "Is [Dish Name] prepared without any [Allergen]?",
    "I am a vegetarian/vegan. I do not eat any meat/animal products.",
    "I believe this food has [Allergen] in it. Please remove it from the table.",
    "Is it possible to prepare this dish without [Ingredient]?",
    "What are the main ingredients in this dish?",
    "Thank you for taking my allergy seriously.",
    "Do you have sugar-free option?",
    "Do you have sugar-free packet/sweetener?",
    "Can you make it sugar-free?",
    "Can you do less sugar?",
    "Can you remove the sugar?",
    "Is this regular sugar or sugar-free?",
    "Can you do less salt?",
    "Can you do no MSG?",
    "Can you remove the MSG?",
    "Less salt for this dish, please.",
    "Is this gluten-free?",
    "Do you have gluten free?",
    "Can you make it fat free?",
    "Can you remove the milk and change it to [Alternative]?",
    "No cheese, please.",
    "Less cheese please.",
    "Is the dish spicy?",
    "Is this spicy?",
    "Can you make it mild please?",
    "Can you make it medium please?",
    "Can you make it not spicy please?"
  ],
  emergencies: [
    "I need help immediately!",
    "Please call the emergency number now!",
    "Can you help me call the police?",
    "I have lost my [Passport/Wallet/Child].",
    "I am having severe difficulty breathing.",
    "I am having chest pains/a sudden headache.",
    "I think my blood pressure/sugar is too [High/Low].",
    "Where is the nearest hospital/urgent care clinic?",
    "Can you take me to the nearest emergency room?",
    "Excuse me, I am being followed. Can you help me?"
  ],
  locations: [
    // Shopping & Daily Needs
    "Supermarket / Grocery store", "Convenience store", "Pharmacy / Drugstore",
    "Mall / Shopping center", "Market / Wet market / Farmers' market",
    "ATM", "Money exchange", "Bank", "Electronics store", "Bookstore",
    "Clothing store", "Souvenir shop",
    // Health & Safety
    "Hospital", "Urgent care clinic", "Emergency room", "Police station",
    "Fire station", "Dental clinic", "Travel clinic", "Optical / Eyeglass store",
    "Walk-in clinic",
    // Transportation & Travel Services
    "Bus station", "Train station", "Metro/subway station", "Taxi stand",
    "Ride-hailing pick-up point", "Airport", "Ferry terminal", "Car rental office",
    "Bike/scooter rental",
    // Food & Dining
    "Restaurant", "Cafe", "Coffee shop", "Bakery", "Food court", "Fast food",
    "Street food stall", "Bar / Pub",
    // Hotels, Lodging & Services
    "Hotel", "Hostel", "Guesthouse", "Airbnb office", "Resort",
    "Front desk / Reception", "Laundry service", "Dry cleaners", "Luggage storage",
    // Religion, Culture & Learning
    "Church", "Temple", "Mosque", "Synagogue", "Shrine", "Cultural center",
    "Museum", "Library", "Historical site", "Tourist information center",
    // Outdoor & Public Spaces
    "Park", "Playground", "Beach", "Hiking trailhead", "Public restroom",
    "City square", "Harbor / Port",
    // Entertainment & Leisure
    "Cinema / Movie theater", "Music venue", "Night market", "Aquarium", "Zoo",
    "Theme park", "Stadium / Sports arena",
    // Services Travelers Need
    "Post office", "Courier service", "Government office (visa/passport help)",
    "Immigration office", "Embassy / Consulate", "Internet cafe", "Coworking space",
    "Photo/printing shop"
  ],
  numbers: [
    "I would like [Number] of these, please.",
    "Is that [Number] dollars/euros/local currency?",
    "Could you please write down the number/price for me?",
    "The total is [Number]. Is that correct?",
    "How many minutes/hours until [Destination/Event]?",
    "My return date is [Month] [Day].",
    "Are you open on [Day of the Week]?",
    // Days of the Week
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
    // Months of the Year
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
    // Counting 1 to 50
    "1 - One", "2 - Two", "3 - Three", "4 - Four", "5 - Five",
    "6 - Six", "7 - Seven", "8 - Eight", "9 - Nine", "10 - Ten",
    "11 - Eleven", "12 - Twelve", "13 - Thirteen", "14 - Fourteen", "15 - Fifteen",
    "16 - Sixteen", "17 - Seventeen", "18 - Eighteen", "19 - Nineteen", "20 - Twenty",
    "21 - Twenty-one", "22 - Twenty-two", "23 - Twenty-three", "24 - Twenty-four", "25 - Twenty-five",
    "26 - Twenty-six", "27 - Twenty-seven", "28 - Twenty-eight", "29 - Twenty-nine", "30 - Thirty",
    "31 - Thirty-one", "32 - Thirty-two", "33 - Thirty-three", "34 - Thirty-four", "35 - Thirty-five",
    "36 - Thirty-six", "37 - Thirty-seven", "38 - Thirty-eight", "39 - Thirty-nine", "40 - Forty",
    "41 - Forty-one", "42 - Forty-two", "43 - Forty-three", "44 - Forty-four", "45 - Forty-five",
    "46 - Forty-six", "47 - Forty-seven", "48 - Forty-eight", "49 - Forty-nine", "50 - Fifty"
  ]
};


// ============================================================================
// REGIONAL DIALECT MAPPING
// Maps countries to their default language and city-specific dialects
// ============================================================================
const REGIONAL_DIALECT_MAP = {
  "Philippines": {
    default_language: "Filipino (Tagalog)",
    default_code: "fil",
    flag: "🇵🇭",
    regions: {
      // Metro Manila - Tagalog
      "Manila": { dialect: "Tagalog", code: "tl", same_as_default: true },
      "Quezon City": { dialect: "Tagalog", code: "tl", same_as_default: true },
      "Makati": { dialect: "Tagalog", code: "tl", same_as_default: true },
      "Pasig": { dialect: "Tagalog", code: "tl", same_as_default: true },
      "Taguig": { dialect: "Tagalog", code: "tl", same_as_default: true },
      // Cebu - Cebuano
      "Cebu": { dialect: "Cebuano (Bisaya)", code: "ceb", same_as_default: false },
      "Cebu City": { dialect: "Cebuano (Bisaya)", code: "ceb", same_as_default: false },
      "Mandaue": { dialect: "Cebuano (Bisaya)", code: "ceb", same_as_default: false },
      "Lapu-Lapu": { dialect: "Cebuano (Bisaya)", code: "ceb", same_as_default: false },
      "Mactan": { dialect: "Cebuano (Bisaya)", code: "ceb", same_as_default: false },
      // Bohol - Boholano (Cebuano variant with y→j)
      "Bohol": { dialect: "Boholano", code: "ceb-bohol", same_as_default: false },
      "Tagbilaran": { dialect: "Boholano", code: "ceb-bohol", same_as_default: false },
      "Panglao": { dialect: "Boholano", code: "ceb-bohol", same_as_default: false },
      "Loboc": { dialect: "Boholano", code: "ceb-bohol", same_as_default: false },
      "Anda": { dialect: "Boholano", code: "ceb-bohol", same_as_default: false },
      "Carmen": { dialect: "Boholano", code: "ceb-bohol", same_as_default: false },
      "Chocolate Hills": { dialect: "Boholano", code: "ceb-bohol", same_as_default: false },
      // Davao - Cebuano (Davao variant)
      "Davao": { dialect: "Cebuano (Davao)", code: "ceb", same_as_default: false },
      "Davao City": { dialect: "Cebuano (Davao)", code: "ceb", same_as_default: false },
      // Western Visayas - Hiligaynon/Ilonggo
      "Iloilo": { dialect: "Hiligaynon (Ilonggo)", code: "hil", same_as_default: false },
      "Iloilo City": { dialect: "Hiligaynon (Ilonggo)", code: "hil", same_as_default: false },
      "Bacolod": { dialect: "Hiligaynon (Ilonggo)", code: "hil", same_as_default: false },
      "Roxas": { dialect: "Hiligaynon (Ilonggo)", code: "hil", same_as_default: false },
      // Eastern Visayas - Waray
      "Tacloban": { dialect: "Waray", code: "war", same_as_default: false },
      "Leyte": { dialect: "Waray", code: "war", same_as_default: false },
      "Samar": { dialect: "Waray", code: "war", same_as_default: false },
      // Northern Luzon - Ilocano
      "Vigan": { dialect: "Ilocano", code: "ilo", same_as_default: false },
      "Laoag": { dialect: "Ilocano", code: "ilo", same_as_default: false },
      "Baguio": { dialect: "Ilocano", code: "ilo", same_as_default: false },
      // Bicol - Bicolano
      "Naga": { dialect: "Bicolano", code: "bik", same_as_default: false },
      "Legazpi": { dialect: "Bicolano", code: "bik", same_as_default: false },
      // Pampanga - Kapampangan
      "Angeles": { dialect: "Kapampangan", code: "pam", same_as_default: false },
      "San Fernando": { dialect: "Kapampangan", code: "pam", same_as_default: false },
      "Clark": { dialect: "Kapampangan", code: "pam", same_as_default: false },
      // Zamboanga - Chavacano (Spanish creole!)
      "Zamboanga": { dialect: "Chavacano", code: "cbk", same_as_default: false },
      "Zamboanga City": { dialect: "Chavacano", code: "cbk", same_as_default: false },
    }
  },
  "China": {
    default_language: "Mandarin Chinese",
    default_code: "zh-CN",
    flag: "🇨🇳",
    regions: {
      "Beijing": { dialect: "Mandarin", code: "zh-CN", same_as_default: true },
      "Shanghai": { dialect: "Shanghainese (Wu)", code: "wuu", same_as_default: false },
      "Hong Kong": { dialect: "Cantonese", code: "yue-HK", same_as_default: false },
      "Guangzhou": { dialect: "Cantonese", code: "yue", same_as_default: false },
      "Shenzhen": { dialect: "Cantonese", code: "yue", same_as_default: false },
      "Macau": { dialect: "Cantonese", code: "yue-HK", same_as_default: false },
      "Taipei": { dialect: "Mandarin (Taiwan)", code: "zh-TW", same_as_default: false },
      "Xiamen": { dialect: "Hokkien (Min Nan)", code: "nan", same_as_default: false },
      "Fuzhou": { dialect: "Min Dong", code: "cdo", same_as_default: false },
    }
  },
  "Spain": {
    default_language: "Spanish (Castilian)",
    default_code: "es-ES",
    flag: "🇪🇸",
    regions: {
      "Madrid": { dialect: "Castilian Spanish", code: "es-ES", same_as_default: true },
      "Barcelona": { dialect: "Catalan", code: "ca", same_as_default: false },
      "Valencia": { dialect: "Valencian", code: "ca", same_as_default: false },
      "Bilbao": { dialect: "Basque (Euskara)", code: "eu", same_as_default: false },
      "San Sebastián": { dialect: "Basque (Euskara)", code: "eu", same_as_default: false },
      "Santiago de Compostela": { dialect: "Galician", code: "gl", same_as_default: false },
      "Vigo": { dialect: "Galician", code: "gl", same_as_default: false },
    }
  },
  "Japan": {
    default_language: "Japanese",
    default_code: "ja",
    flag: "🇯🇵",
    regions: {
      "Tokyo": { dialect: "Standard Japanese", code: "ja", same_as_default: true },
      "Osaka": { dialect: "Kansai-ben", code: "ja", same_as_default: false, note: "Kansai dialect expressions" },
      "Kyoto": { dialect: "Kansai-ben", code: "ja", same_as_default: false, note: "Kansai dialect expressions" },
      "Okinawa": { dialect: "Okinawan (Uchinaaguchi)", code: "ryu", same_as_default: false },
    }
  },
  "Italy": {
    default_language: "Italian",
    default_code: "it-IT",
    flag: "🇮🇹",
    regions: {
      "Rome": { dialect: "Italian", code: "it-IT", same_as_default: true },
      "Milan": { dialect: "Italian", code: "it-IT", same_as_default: true },
      "Naples": { dialect: "Neapolitan", code: "nap", same_as_default: false },
      "Palermo": { dialect: "Sicilian", code: "scn", same_as_default: false },
      "Venice": { dialect: "Venetian", code: "vec", same_as_default: false },
    }
  },
  "Germany": {
    default_language: "German",
    default_code: "de-DE",
    flag: "🇩🇪",
    regions: {
      "Berlin": { dialect: "Standard German", code: "de-DE", same_as_default: true },
      "Munich": { dialect: "Bavarian", code: "bar", same_as_default: false },
      "Zurich": { dialect: "Swiss German", code: "gsw", same_as_default: false },
      "Vienna": { dialect: "Austrian German", code: "de-DE", same_as_default: false },
      "Cologne": { dialect: "Kölsch", code: "ksh", same_as_default: false },
    }
  },
  "France": {
    default_language: "French",
    default_code: "fr-FR",
    flag: "🇫🇷",
    regions: {
      "Paris": { dialect: "French", code: "fr-FR", same_as_default: true },
      "Marseille": { dialect: "Occitan/French", code: "fr-FR", same_as_default: true },
      "Montreal": { dialect: "Québécois French", code: "fr-CA", same_as_default: false },
      "Quebec City": { dialect: "Québécois French", code: "fr-CA", same_as_default: false },
    }
  },
  "Brazil": {
    default_language: "Portuguese",
    default_code: "pt-BR",
    flag: "🇧🇷",
    regions: {
      "São Paulo": { dialect: "Brazilian Portuguese", code: "pt-BR", same_as_default: true },
      "Rio de Janeiro": { dialect: "Carioca Portuguese", code: "pt-BR", same_as_default: true },
    }
  },
  "Portugal": {
    default_language: "Portuguese",
    default_code: "pt-PT",
    flag: "🇵🇹",
    regions: {
      "Lisbon": { dialect: "European Portuguese", code: "pt-PT", same_as_default: true },
      "Porto": { dialect: "European Portuguese", code: "pt-PT", same_as_default: true },
    }
  },
  "Mexico": {
    default_language: "Spanish",
    default_code: "es-MX",
    flag: "🇲🇽",
    regions: {
      "Mexico City": { dialect: "Mexican Spanish", code: "es-MX", same_as_default: true },
      "Cancún": { dialect: "Mexican Spanish", code: "es-MX", same_as_default: true },
    }
  },
  "South Korea": {
    default_language: "Korean",
    default_code: "ko-KR",
    flag: "🇰🇷",
    regions: {
      "Seoul": { dialect: "Korean", code: "ko-KR", same_as_default: true },
      "Busan": { dialect: "Gyeongsang dialect", code: "ko-KR", same_as_default: false },
    }
  },
  "Thailand": {
    default_language: "Thai",
    default_code: "th-TH",
    flag: "🇹🇭",
    regions: {
      "Bangkok": { dialect: "Central Thai", code: "th-TH", same_as_default: true },
      "Chiang Mai": { dialect: "Northern Thai (Kam Muang)", code: "th-TH", same_as_default: false },
      "Phuket": { dialect: "Southern Thai", code: "th-TH", same_as_default: false },
    }
  },
  "Vietnam": {
    default_language: "Vietnamese",
    default_code: "vi-VN",
    flag: "🇻🇳",
    regions: {
      "Hanoi": { dialect: "Northern Vietnamese", code: "vi-VN", same_as_default: true },
      "Ho Chi Minh City": { dialect: "Southern Vietnamese", code: "vi-VN", same_as_default: false },
      "Da Nang": { dialect: "Central Vietnamese", code: "vi-VN", same_as_default: false },
    }
  },
  "Indonesia": {
    default_language: "Indonesian",
    default_code: "id-ID",
    flag: "🇮🇩",
    regions: {
      "Jakarta": { dialect: "Indonesian", code: "id-ID", same_as_default: true },
      "Bali": { dialect: "Balinese", code: "ban", same_as_default: false },
      "Yogyakarta": { dialect: "Javanese", code: "jv", same_as_default: false },
      "Surabaya": { dialect: "Javanese", code: "jv", same_as_default: false },
      "Bandung": { dialect: "Sundanese", code: "su", same_as_default: false },
    }
  },
  "Malaysia": {
    default_language: "Malay",
    default_code: "ms-MY",
    flag: "🇲🇾",
    regions: {
      "Kuala Lumpur": { dialect: "Malay", code: "ms-MY", same_as_default: true },
      "Penang": { dialect: "Penang Hokkien", code: "nan", same_as_default: false },
    }
  },
  "India": {
    default_language: "Hindi",
    default_code: "hi-IN",
    flag: "🇮🇳",
    regions: {
      "Delhi": { dialect: "Hindi", code: "hi-IN", same_as_default: true },
      "Mumbai": { dialect: "Hindi/Marathi", code: "hi-IN", same_as_default: true },
      "Chennai": { dialect: "Tamil", code: "ta-IN", same_as_default: false },
      "Bangalore": { dialect: "Kannada", code: "kn-IN", same_as_default: false },
      "Kolkata": { dialect: "Bengali", code: "bn-IN", same_as_default: false },
      "Hyderabad": { dialect: "Telugu", code: "te-IN", same_as_default: false },
    }
  },
};

const TTS_SUPPORTED = [
  'en', 'en-US', 'en-GB', 'es', 'es-ES', 'es-MX', 'fr', 'fr-FR', 'de', 'de-DE',
  'it', 'it-IT', 'pt', 'pt-BR', 'ja', 'ja-JP', 'ko', 'ko-KR', 'zh-CN', 'cmn-CN',
  'yue-HK', 'vi', 'vi-VN', 'th', 'th-TH', 'id', 'id-ID', 'fil', 'fil-PH', 'tl',
  'ar', 'hi', 'bn', 'ta', 'te', 'ru', 'pl', 'nl', 'tr', 'sv', 'da', 'no', 'fi'
];

const DIALECT_TTS_FALLBACK = {
  'ceb': 'fil-PH', 'ceb-bohol': 'fil-PH', 'hil': 'fil-PH', 'war': 'fil-PH',
  'wuu': 'zh-CN', 'yue': 'yue-HK', 'ca': 'es-ES', 'eu': 'es-ES',
};

// The situations. icon: the lucide icon on the row's thumb-index tab; priority 'emergency'
// stamps the tab red (allergies and emergencies).
const PHRASE_CATEGORIES = [
  { id: "basics", icon: Globe, name: "Essential Basics", subtitle: "Polite & general communication", priority: "high" },
  { id: "directions", icon: MapIcon, name: "Finding Your Way", subtitle: "Directions & locations", priority: "high" },
  { id: "transportation", icon: CarTaxiFront, name: "Transportation", subtitle: "Taxi, bus, train, airport", priority: "high" },
  { id: "accommodation", icon: BedDouble, name: "Hotels & Lodging", subtitle: "Check-in, requests, problems", priority: "high" },
  { id: "shopping", icon: Wallet, name: "Shopping & Money", subtitle: "Prices, payment, exchange", priority: "high" },
  { id: "grocery", icon: ShoppingBasket, name: "Market & Grocery Shopping", subtitle: "Basic food items list", priority: "medium" },
  { id: "allergies", icon: WheatOff, name: "Food Allergies & Dietary Needs", subtitle: "Critical phrases for safe dining", priority: "emergency" },
  { id: "emergencies", icon: Siren, name: "Emergency Help", subtitle: "Safety, medical, critical assistance", priority: "emergency" },
  { id: "locations", icon: MapPin, name: "Key Locations & Services", subtitle: "Where to find things", priority: "medium" },
  { id: "numbers", icon: Hash, name: "Numbers & Counting", subtitle: "Quantities, dates, clarity", priority: "medium" }
];

const ENGLISH_SPEAKING_COUNTRIES = [
  "United States", "USA", "United Kingdom", "Great Britain", "England",
  "Canada", "Australia", "New Zealand", "Ireland"
];

// Languages a user can translate FROM (to English) while in an English region —
// covers the 2026 World Cup host/contestant nations' languages plus widely-used
// travel languages. Audio always plays the English equivalent, so any language
// here works regardless of TTS voice support. Sorted by name.
const AVAILABLE_LANGUAGES = [
  { code: "ar", name: "Arabic" },
  { code: "bs", name: "Bosnian" },
  { code: "kea", name: "Cape Verdean Creole" },
  { code: "zh", name: "Chinese (Mandarin)" },
  { code: "hr", name: "Croatian" },
  { code: "cs", name: "Czech" },
  { code: "nl", name: "Dutch" },
  { code: "tl", name: "Filipino (Tagalog)" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "gn", name: "Guaraní" },
  { code: "ht", name: "Haitian Creole" },
  { code: "hi", name: "Hindi" },
  { code: "id", name: "Indonesian" },
  { code: "it", name: "Italian" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "ku", name: "Kurdish" },
  { code: "lo", name: "Lao" },
  { code: "ln", name: "Lingala" },
  { code: "ms", name: "Malay" },
  { code: "mi", name: "Māori" },
  { code: "no", name: "Norwegian" },
  { code: "pap", name: "Papiamento" },
  { code: "fa", name: "Persian (Farsi)" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
  { code: "es", name: "Spanish" },
  { code: "sv", name: "Swedish" },
  { code: "th", name: "Thai" },
  { code: "tr", name: "Turkish" },
  { code: "uz", name: "Uzbek" },
  { code: "vi", name: "Vietnamese" },
  { code: "wo", name: "Wolof" }
];

// ============================================================================
// THE NEW LOOK: rows and controls (Phrases.dc.html L50-170)
// ============================================================================

// Phonetics without the [pointing] notes and ____ blanks the phrases carry.
const cleanPhonetic = (text) => (text ? text.replace(/\[.*?\]/g, '').replace(/_+/g, '').replace(/\s+/g, ' ').trim() : '');

// Formal and casual differ only when the data says so, or when the casual line is its own.
function hasDifferentFormality(phrase) {
  if (phrase.same_formality === true) return false;
  if (phrase.same_formality === false) return true;
  const formal = (phrase.formal_translation || '').toLowerCase().trim();
  const casual = (phrase.casual_translation || '').toLowerCase().trim();
  return formal !== casual && casual !== '';
}

// The mono chips ('Say it', 'Formal · polite', 'Casual', a search result's situation).
function Chip({ children, small = false }) {
  return (
    <span style={{ flexShrink: 0, padding: small ? "1px 6px" : "2px 7px", borderRadius: 6, background: W.wash, color: W.washInk, fontFamily: MONO, fontSize: fs(small ? 9 : 9.5), fontWeight: 500, letterSpacing: ".1em", lineHeight: 1.47, textTransform: "uppercase", whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

// How to say it: the 'Say it' chip and the pronunciation in mono.
function SayIt({ text }) {
  if (!text) return null;
  return (
    <p style={{ margin: "4px 0 0", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
      <Chip>Say it</Chip>
      <span style={{ minWidth: 0, fontFamily: MONO, fontSize: fs(12), lineHeight: 1.33, color: W.washInk, overflowWrap: "anywhere" }}>{text}</span>
    </p>
  );
}

// The 44px mustard speaker; ink while it plays.
function Speaker({ text, playing, onClick }) {
  return (
    <button type="button" onClick={onClick} disabled={!!playing} aria-label={`Listen to ${text}`} aria-busy={playing || undefined}
      style={{ flexShrink: 0, width: 44, height: 44, padding: 0, borderRadius: 999, background: playing ? W.ink : W.plate, border: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: playing ? "default" : "pointer" }}>
      <Volume2 size={20} color={playing ? NEUTRAL.white : W.ink} strokeWidth={2} aria-hidden="true" className={playing ? "animate-pulse motion-reduce:animate-none" : undefined} />
    </button>
  );
}

const meaningStyle = { margin: 0, fontSize: fs(14), lineHeight: 1.36, color: NEUTRAL.ink2 };
const phraseStyle = { margin: "2px 0 0", fontFamily: SERIF, fontSize: fs(24), lineHeight: 1.17, color: W.ink, overflowWrap: "break-word" };

// One phrase, as the open situation (or a search result) prints it. mode: 'normal' (the
// meaning, then the phrase to say), 'reverse' (your language first, then the English to
// say) or 'english' (English only). kicker: a search result's situation. inset: the 44px
// left inset that lines rows up under a situation's name.
function PhraseRow({ phrase, rowKey, mode, langCode, readCode, ttsCode, playingAudio, speak, kicker = null, inset = true, first = false }) {
  const pad = { padding: inset ? "12px 14px 12px 44px" : "12px 14px", borderTop: first ? 0 : `1px solid ${W.line}` };
  const head = kicker ? <p style={{ margin: "0 0 4px" }}><Chip small>{kicker}</Chip></p> : null;
  if (mode === "english" || mode === "reverse") {
    return (
      <div style={pad}>
        {head}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {mode === "reverse" ? <p lang={readCode} style={meaningStyle}>{phrase.formal_translation || phrase.translation}</p> : null}
            <p lang="en" style={mode === "reverse" ? phraseStyle : { ...phraseStyle, margin: 0 }}>{phrase.english}</p>
          </div>
          <Speaker text={phrase.english} playing={playingAudio[rowKey]} onClick={() => speak(phrase.english, "en", rowKey)} />
        </div>
      </div>
    );
  }
  const formal = phrase.formal_translation || phrase.translation;
  if (!hasDifferentFormality(phrase)) {
    return (
      <div style={pad}>
        {head}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={meaningStyle}>{phrase.english}</p>
            {formal ? <p lang={langCode} style={phraseStyle}>{formal}</p> : null}
          </div>
          {formal ? <Speaker text={formal} playing={playingAudio[rowKey]} onClick={() => speak(formal, ttsCode, rowKey, phrase.audio_url)} /> : null}
        </div>
        <SayIt text={cleanPhonetic(phrase.formal_phonetic || phrase.phonetic)} />
        {phrase.romanization ? <p style={{ margin: "4px 0 0", fontSize: fs(12), lineHeight: 1.4, color: NEUTRAL.ink3 }}>Romanized: {phrase.romanization}</p> : null}
      </div>
    );
  }
  const versions = [
    { key: "formal", label: "Formal · polite", text: formal, phonetic: phrase.formal_phonetic || phrase.phonetic, audio: phrase.audio_url, roman: phrase.romanization },
    { key: "casual", label: "Casual", text: phrase.casual_translation || formal, phonetic: phrase.casual_phonetic || phrase.formal_phonetic || phrase.phonetic },
  ];
  return (
    <div style={pad}>
      {head}
      <p style={meaningStyle}>{phrase.english}</p>
      {versions.map((v) => (
        <div key={v.key} style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${W.line}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Chip small>{v.label}</Chip>
              <p lang={langCode} style={{ ...phraseStyle, marginTop: 4 }}>{v.text}</p>
            </div>
            <Speaker text={v.text} playing={playingAudio[`${rowKey}_${v.key}`]} onClick={() => speak(v.text, ttsCode, `${rowKey}_${v.key}`, v.audio)} />
          </div>
          <SayIt text={cleanPhonetic(v.phonetic)} />
          {v.roman ? <p style={{ margin: "4px 0 0", fontSize: fs(12), lineHeight: 1.4, color: NEUTRAL.ink3 }}>Romanized: {v.roman}</p> : null}
        </div>
      ))}
    </div>
  );
}

// One choice in the language sheet: a full-width row, ticked when it is the one in use.
function OptionRow({ title, sub = null, selected = false, onClick }) {
  return (
    <li>
      <button type="button" onClick={onClick} aria-current={selected ? "true" : undefined}
        style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 52, boxSizing: "border-box", padding: "8px 4px", background: "transparent", border: 0, borderBottom: `1px solid ${W.line}`, fontFamily: "inherit", textAlign: "left", cursor: "pointer" }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: fs(15), fontWeight: selected ? 600 : 400, lineHeight: 1.3, color: NEUTRAL.ink }}>{title}</span>
          {sub ? <span style={{ display: "block", marginTop: 1, fontSize: fs(12.5), lineHeight: 1.35, color: NEUTRAL.ink3 }}>{sub}</span> : null}
        </span>
        {selected ? <Check size={18} color={W.ink} strokeWidth={2.4} aria-hidden="true" style={{ flexShrink: 0 }} /> : null}
      </button>
    </li>
  );
}

const KICKER = { high: "Essential", medium: "Useful", emergency: "Priority" };

export default function BasicPhrasesPage() {
  const { user: authUser, profile } = useAuth();
  const isTablet = useIsTablet();
  const { activeLocation, locationMode, initialized } = useLocation();
  const [loading, setLoading] = useState(true);
  const [languageInfo, setLanguageInfo] = useState(null);
  const [phrases, setPhrases] = useState({});
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [loadingPhrases, setLoadingPhrases] = useState({});
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [useDialect, setUseDialect] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [playingAudio, setPlayingAudio] = useState({});
  
  const [isInEnglishCountry, setIsInEnglishCountry] = useState(false);
  const [userHomeIsEnglish, setUserHomeIsEnglish] = useState(false);
  const [selectedTranslationLanguage, setSelectedTranslationLanguage] = useState(null);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [wantsTranslation, setWantsTranslation] = useState(false);
  const [ttsWarning, setTtsWarning] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    loadLocationAndLanguage();
  }, []);

  useEffect(() => {
    if (initialized && activeLocation?.address) {
      detectLanguageAndDialect();
      setPhrases({});
      setExpandedCategory(null);
    }
  }, [activeLocation, initialized]);

  useEffect(() => {
    if (selectedTranslationLanguage) {
      setPhrases({});
      setExpandedCategory(null);
    }
  }, [selectedTranslationLanguage]);

  const loadLocationAndLanguage = async () => {
    try {
      const userData = legacyUser(authUser, profile) || {};
      setUserProfile(userData);
      
      const userHomeCountry = userData?.home_country || "";
      const isUserHomeEnglish = ENGLISH_SPEAKING_COUNTRIES.some(
        country => userHomeCountry.toLowerCase().includes(country.toLowerCase())
      );
      setUserHomeIsEnglish(isUserHomeEnglish);
      
      await detectLanguageAndDialect();
      setLoading(false);
    } catch (error) {
      console.error("Error loading data:", error);
      setLoading(false);
    }
  };

  const detectLanguageAndDialect = async () => {
    if (!activeLocation?.address) {
      return;
    }
    
    // Get city from various possible fields
    const rawCity = activeLocation.address.city || 
                    activeLocation.address.municipality ||
                    activeLocation.address.town ||
                    activeLocation.address.village ||
                    activeLocation.address.state ||
                    activeLocation.placeName || "";
    const country = activeLocation.address.country || "";
    
    // Normalize city name for matching (remove "City", extra spaces, etc.)
    const normalizeForMatch = (str) => {
      return str.toLowerCase()
        .replace(/\s+city$/i, '')
        .replace(/\s+town$/i, '')
        .replace(/\s+municipality$/i, '')
        .replace(/\s+province$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
    };
    
    const city = normalizeForMatch(rawCity);

    const inEnglishCountry = ENGLISH_SPEAKING_COUNTRIES.some(
      ec => country.toLowerCase().includes(ec.toLowerCase())
    );
    setIsInEnglishCountry(inEnglishCountry);
    
    const isUserHomeEnglish = ENGLISH_SPEAKING_COUNTRIES.some(
      ec => (userProfile?.home_country || "").toLowerCase().includes(ec.toLowerCase())
    );
    
    // English-speaking country + English-speaking user = English only mode
    if (inEnglishCountry && isUserHomeEnglish) {
      setLanguageInfo({
        country, 
        country_language: "English", 
        country_language_code: "en",
        city_language: "English", 
        city_language_code: "en",
        has_different_dialect: false, 
        is_english_only_mode: true, 
        tts_supported: true,
        show_toggle: false
      });
      setWantsTranslation(false);
      setTtsWarning(null);
      return;
    }
    
    // English-speaking country + non-English user = reverse mode (practice English)
    if (inEnglishCountry && !isUserHomeEnglish) {
      setLanguageInfo({
        country, 
        country_language: "English", 
        country_language_code: "en",
        city_language: "English", 
        city_language_code: "en",
        has_different_dialect: false, 
        is_reverse_mode: true, 
        tts_supported: true,
        show_toggle: false
      });
      setWantsTranslation(false);
      setTtsWarning(null);
      return;
    }
    
    // Non-English country - check for regional dialects
    const countryMapping = REGIONAL_DIALECT_MAP[country];
    
    if (countryMapping) {
      // Try to find a matching city/region with flexible matching
      let dialectInfo = null;
      let matchedCity = null;
      
      for (const [locationKey, info] of Object.entries(countryMapping.regions)) {
        const normalizedKey = normalizeForMatch(locationKey);
        
        // Check multiple matching strategies
        const matches = 
          city === normalizedKey ||                           // Exact match
          city.includes(normalizedKey) ||                     // City contains region
          normalizedKey.includes(city) ||                     // Region contains city
          rawCity.toLowerCase().includes(locationKey.toLowerCase()) ||  // Raw contains key
          locationKey.toLowerCase().includes(rawCity.toLowerCase());    // Key contains raw
        
        if (matches) {
          dialectInfo = info;
          matchedCity = locationKey;
          break;
        }
      }
      
      // If we found a city-specific dialect
      if (dialectInfo) {
        const hasDifferentDialect = !dialectInfo.same_as_default;
        const dialectTtsSupported = TTS_SUPPORTED.includes(dialectInfo.code);
        const countryTtsSupported = TTS_SUPPORTED.includes(countryMapping.default_code);
        
        // Determine TTS code to use (fallback if dialect not supported)
        const dialectTtsCode = dialectTtsSupported 
          ? dialectInfo.code 
          : (DIALECT_TTS_FALLBACK[dialectInfo.code] || countryMapping.default_code);
        
        // Set warning if using fallback voice
        if (hasDifferentDialect && !dialectTtsSupported) {
          const fallbackLang = DIALECT_TTS_FALLBACK[dialectInfo.code] 
            ? (VOICE_MAP_NAMES[DIALECT_TTS_FALLBACK[dialectInfo.code]] || countryMapping.default_language)
            : countryMapping.default_language;
          setTtsWarning({
            dialect: dialectInfo.dialect,
            fallbackLanguage: fallbackLang,
            message: `${dialectInfo.dialect} uses ${fallbackLang} voice for pronunciation.`
          });
        } else {
          setTtsWarning(null);
        }
        
        setLanguageInfo({
          country,
          country_flag: countryMapping.flag,
          country_language: countryMapping.default_language,
          country_language_code: countryMapping.default_code,
          city: matchedCity,
          city_language: dialectInfo.dialect,
          city_language_code: dialectInfo.code,
          city_tts_code: dialectTtsCode,
          has_different_dialect: hasDifferentDialect,
          show_toggle: hasDifferentDialect,
          tts_supported: dialectTtsSupported || countryTtsSupported,
          dialect_note: dialectInfo.note || null
        });
        
        // Default to city dialect if different from country
        if (hasDifferentDialect) {
          setUseDialect(true);
        } else {
          setUseDialect(false);
        }
        
        // Clear phrases when language changes
        setPhrases({});
        return;
      }
      
      // No specific city match - use country default
      setTtsWarning(null);
      setUseDialect(false);
      setPhrases({});
      setLanguageInfo({
        country,
        country_flag: countryMapping.flag,
        country_language: countryMapping.default_language,
        country_language_code: countryMapping.default_code,
        city_language: countryMapping.default_language,
        city_language_code: countryMapping.default_code,
        has_different_dialect: false,
        show_toggle: false,
        tts_supported: TTS_SUPPORTED.includes(countryMapping.default_code),
      });
      return;
    }
    
    // Unknown country - try to detect language by country name
    setLanguageInfo({
      country,
      country_language: "Local language",
      country_language_code: "en",
      city_language: "Local language",
      city_language_code: "en",
      has_different_dialect: false,
      show_toggle: false,
      tts_supported: false,
    });
  };

  // Voice names for display
  const VOICE_MAP_NAMES = {
    'fil-PH': 'Filipino',
    'es-ES': 'Spanish',
    'zh-CN': 'Mandarin',
    'ja': 'Japanese',
    'id-ID': 'Indonesian',
  };

  const getActiveLanguageCode = () => {
    if (isInEnglishCountry && wantsTranslation && selectedTranslationLanguage) return selectedTranslationLanguage.code;
    if (useDialect) return languageInfo?.city_language_code || 'en';
    return languageInfo?.country_language_code || 'en';
  };

  const getActiveLanguageName = () => {
    if (isInEnglishCountry && wantsTranslation && selectedTranslationLanguage) return selectedTranslationLanguage.name;
    if (useDialect) return languageInfo?.city_language || 'English';
    return languageInfo?.country_language || 'English';
  };

  const getActiveTTSCode = () => {
    if (isInEnglishCountry && wantsTranslation && selectedTranslationLanguage) return 'en';
    if (useDialect) return languageInfo?.city_tts_code || languageInfo?.city_language_code || 'en';
    return languageInfo?.country_language_code || 'en';
  };

  const getCacheKey = (categoryId, languageCode) => {
    // Reverse mode (English region, translating TO a foreign language) is
    // generated with a lean translation-only payload, so tag its cache key with
    // _rev. This keeps the lean reverse data from overwriting (or being served
    // in place of) the full normal-mode data — phonetic/casual/romanization —
    // for the same language code. Both read and write go through here, so the
    // tag stays consistent.
    const rev = (isInEnglishCountry && wantsTranslation) ? '_rev' : '';
    return `phrases_v15_${categoryId}_${languageCode}${rev}`; // v15: Supabase-sourced (old AI caches ignored)
  };

  // Curated, pre-seeded translations from Supabase (`phrase_translations`) — the
  // SOURCE OF TRUTH. Public read (anon key). Returns the app's phrase shape, or
  // null for a language/dialect not yet seeded (caller then falls back to AI).
  const fetchSupabasePhrases = async (languageCode, categoryId) => {
    try {
      const { data, error } = await supabase
        .from('phrase_translations')
        .select('phrase_index,english,formal,casual,formal_phonetic,casual_phonetic,romanization,same_formality,audio_formal_url')
        .eq('language_code', languageCode)
        .eq('category', categoryId)
        .order('phrase_index');
      if (error || !data || data.length === 0) return null;
      return data.map((r) => ({
        english: r.english,
        formal_translation: r.formal || '',
        formal_phonetic: r.formal_phonetic || '',
        casual_translation: r.casual || r.formal || '',
        casual_phonetic: r.casual_phonetic || '',
        same_formality: r.same_formality ?? true,
        romanization: r.romanization || '',
        audio_url: r.audio_formal_url || null,
      }));
    } catch {
      return null;
    }
  };

  // Try localStorage first (instant), then Cloudflare KV
  const getCachedPhrases = async (categoryId, languageCode) => {
    const cacheKey = getCacheKey(categoryId, languageCode);
    
    // 1. Check localStorage (instant, per-user, forever)
    try {
      const localCached = localStorage.getItem(cacheKey);
      if (localCached) {
        const data = JSON.parse(localCached);
        if (data.phrases && data.phrases.length > 0) {
          return data.phrases;
        }
      }
    } catch (e) {
      console.error('localStorage read error:', e);
    }
    
    // 2. Check Cloudflare KV (shared across all users)
    try {
      const response = await fetch(`${CLOUDFLARE_TTS_URL}?action=getTranslation&key=${encodeURIComponent(cacheKey)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.phrases && data.phrases.length > 0) {
          // Save to localStorage for faster access next time
          try {
            localStorage.setItem(cacheKey, JSON.stringify({ phrases: data.phrases, timestamp: Date.now() }));
          } catch (e) { /* localStorage full */ }
          return data.phrases;
        }
      }
    } catch {
      // Cloudflare KV check failed - fall through to return null
    }

    return null;
  };

  // Save to both localStorage and Cloudflare KV
  const saveCachedPhrases = async (categoryId, languageCode, phrasesData) => {
    const cacheKey = getCacheKey(categoryId, languageCode);
    
    // 1. Save to localStorage (instant access for this user)
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ phrases: phrasesData, timestamp: Date.now() }));
    } catch (e) {
      console.error('localStorage write error:', e);
    }
    
    // 2. Save to Cloudflare KV (shared with all users - don't await)
    try {
      fetch(`${CLOUDFLARE_TTS_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'saveTranslation',
          key: cacheKey,
          phrases: phrasesData
        })
      }).catch(() => {
        // Cloudflare KV save failed - non-fatal, localStorage already has it
      });
    } catch {
      // Cloudflare KV save error - non-fatal, localStorage already has it
    }
  };

  // ============================================================================
  // LOAD PHRASES - Instant for English, cached translations for other languages
  // ============================================================================
  const loadCategoryPhrases = async (categoryId) => {
    if (phrases[categoryId]) {
      return;
    }
    if (!languageInfo) {
      return;
    }

    const isEnglishOnly = isInEnglishCountry && !wantsTranslation;
    const languageCode = getActiveLanguageCode();
    const languageName = getActiveLanguageName();

    // English = instant load (no translation needed)
    if (isEnglishOnly || languageCode === 'en') {
      const englishPhrases = PRESET_PHRASES[categoryId].map(phrase => ({
        english: phrase, 
        translation: phrase, 
        phonetic: "",
        romanization: ""
      }));
      setPhrases(prev => ({ ...prev, [categoryId]: englishPhrases }));
      return;
    }

    // Show loading state
    setLoadingPhrases(prev => ({ ...prev, [categoryId]: true }));

    // Check cache (localStorage first, then Cloudflare KV)
    const cached = await getCachedPhrases(categoryId, languageCode);
    if (cached) {
      setPhrases(prev => ({ ...prev, [categoryId]: cached }));
      setLoadingPhrases(prev => ({ ...prev, [categoryId]: false }));
      return;
    }

    // Supabase curated translations — the SOURCE OF TRUTH, ahead of live AI.
    // (The v15 cache key above means old AI-era caches never short-circuit this.)
    // Cached locally after the first hit; falls through to AI generation only
    // for languages/dialects not yet seeded into the DB.
    const seeded = await fetchSupabasePhrases(languageCode, categoryId);
    if (seeded) {
      setPhrases(prev => ({ ...prev, [categoryId]: seeded }));
      saveCachedPhrases(categoryId, languageCode, seeded);
      setLoadingPhrases(prev => ({ ...prev, [categoryId]: false }));
      return;
    }

    // ── REVERSE MODE FAST PATH ──────────────────────────────────────────────
    // English region + user picked a foreign language to translate TO. The
    // reverse UI only renders the foreign translation + the English line (no
    // phonetic / casual / romanization), so we ask Haiku for ONLY
    // {english, translation} per phrase instead of the full 7-field payload.
    // That is ~5-7x fewer output tokens — and output-token generation is the
    // entire cold-start latency — so the translations pop up far faster. The
    // unused fields are filled blank to keep the existing phrase shape intact.
    const isReverseMode = isInEnglishCountry && wantsTranslation && selectedTranslationLanguage;
    if (isReverseMode) {
      const presetPhrases = PRESET_PHRASES[categoryId];
      try {
        const result = await invokeLLM({
          prompt: `Translate each English phrase into ${languageName} (${languageCode}). Return a JSON object {"phrases":[{"english","translation"}]} with EXACTLY one entry per input phrase, in the SAME ORDER. Keep any placeholders like [Name], [Destination] and _____ blanks unchanged inside the translation. Do not add notes or pronunciation.

PHRASES:
${presetPhrases.map((p, i) => `${i + 1}. ${p}`).join('\n')}`,
          response_json_schema: {
            type: "object",
            properties: {
              phrases: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    english: { type: "string" },
                    translation: { type: "string" }
                  },
                  required: ["english", "translation"]
                }
              }
            },
            required: ["phrases"]
          }
        });
        const arr = Array.isArray(result?.phrases) ? result.phrases : [];
        const byEnglish = new Map(arr.map(x => [(x.english || '').trim(), x.translation]));
        const translatedPhrases = presetPhrases.map((p, i) => {
          const translation = byEnglish.get(p.trim()) || arr[i]?.translation || p;
          return {
            english: p,
            formal_translation: translation,
            formal_phonetic: "",
            casual_translation: translation,
            casual_phonetic: "",
            same_formality: true,
            romanization: ""
          };
        });
        setPhrases(prev => ({ ...prev, [categoryId]: translatedPhrases }));
        await saveCachedPhrases(categoryId, languageCode, translatedPhrases);
      } catch (error) {
        console.error(`❌ Reverse translation error for ${categoryId}:`, error);
        const fallbackPhrases = presetPhrases.map(phrase => ({
          english: phrase, formal_translation: phrase, formal_phonetic: "",
          casual_translation: phrase, casual_phonetic: "", same_formality: true, romanization: ""
        }));
        setPhrases(prev => ({ ...prev, [categoryId]: fallbackPhrases }));
      }
      setLoadingPhrases(prev => ({ ...prev, [categoryId]: false }));
      return;
    }

    // Translate with AI (only happens once per language, then cached globally)
    try {
      const presetPhrases = PRESET_PHRASES[categoryId];
      
      // Determine if we need romanization (non-Latin scripts)
      const needsRomanization = ['ja', 'ko', 'zh', 'zh-CN', 'zh-TW', 'cmn', 'yue', 'yue-HK', 
        'th', 'ar', 'he', 'hi', 'bn', 'ta', 'te', 'kn', 'ml', 'gu', 'pa', 'mr',
        'ru', 'uk', 'el', 'am', 'ka', 'hy'].some(code => 
          languageCode.toLowerCase().startsWith(code)
        );
      
      const result = await invokeLLM({
        prompt: `Translate these English phrases to ${languageName} (${languageCode}).

PHRASES TO TRANSLATE:
${presetPhrases.map((p, i) => `${i + 1}. ${p}`).join('\n')}

REQUIREMENTS:
1. For EACH phrase, determine if there is a meaningful difference between formal/polite and casual speech in ${languageName}:
   - If YES (different ways to say it): provide BOTH formal and casual translations
   - If NO (only one way to say it): provide the same translation for both, set "same_formality" to true

2. FORMAL/POLITE version - appropriate for speaking to strangers, officials, elders, service staff
   CASUAL version - appropriate for friends, peers, informal situations

3. Add PHONETIC pronunciation guide for the translations (how to SAY it using English letters)
   - Example for Japanese "Thank you": 
     - formal_phonetic = "ah-ree-gah-toh go-zai-mahs"
     - casual_phonetic = "ah-ree-gah-toh"
   - Use simple syllables an English speaker can read
   - SKIP any text in [brackets] - do not include them in phonetic
   - SKIP any _________ blanks in the phonetic guide
   
   IMPORTANT FOR PHILIPPINE LANGUAGES (Filipino, Tagalog, Cebuano, Boholano, Hiligaynon, Waray, Ilocano, Bicolano, Kapampangan, Chavacano):
   
   VOWEL PRONUNCIATION RULES:
   - "a" is ALWAYS pronounced as "ah" (like "ah" in "aha!" or "father") - NEVER like "ey" in "Macy" or "lazy"
   - "e" is ALWAYS pronounced as "eh" (like "e" in "bed")
   - "i" is ALWAYS pronounced as "ee" (like "ee" in "eel" or "seal")
   - "o" is ALWAYS pronounced as "oh" (like "o" in "oracle") with STRONG emphasis on the O sound
   - "u" is ALWAYS pronounced as "ooh" (like "oo" in "soon" but held TWICE as long)
   
   CONSECUTIVE VOWELS: When two vowels are next to each other, pronounce EACH vowel separately and distinctly:
   - "gabii" (night) = "gah-BEE-ee" (each vowel is separate)
   - "buhay" = "booh-HY" 
   - "maayong" = "mah-AH-yong" (a-a are two separate "ah" sounds)
   - "paalam" = "pah-ah-lahm" (a-a are two separate "ah" sounds)
   - "paalala" = "pah-ah-LAH-lah"
   
   EXAMPLES:
   - "salamat" = "sah-lah-MAHT"
   - "kumusta" = "kooh-MOOH-stah"
   - "magandang umaga" = "mah-gahn-dahng ooh-MAH-gah"
   - "paalam" = "pah-AH-lahm"
   
   SPECIAL FOR BOHOLANO DIALECT ONLY (not for Filipino/Tagalog):
   - The letter "y" is pronounced as "j" (like in "just") EXCEPT when "y" is at the END of a word
   - This rule applies ONLY to Boholano - Filipino/Tagalog always uses regular "y" sound
   - Example: Boholano "Maayo" = "mah-AH-jo", but Filipino "Maayo" = "mah-AH-yoh"

4. ${needsRomanization ? 'Add romanization for formal version (standard transliteration system)' : 'Leave romanization empty'}

5. Keep placeholders like [Name], [Destination], _________ as-is in translation fields

6. Set "same_formality": true if the formal and casual translations are identical or nearly identical in this language/context. Set false if they differ meaningfully.

Return a JSON object with "phrases" array. Each phrase object needs:
- english: original English phrase
- formal_translation: formal/polite translation in ${languageName}
- formal_phonetic: pronunciation guide for formal version
- casual_translation: casual/informal translation (same as formal if no difference)
- casual_phonetic: pronunciation guide for casual version
- same_formality: boolean - true if formal and casual are the same, false if different
- romanization: ${needsRomanization ? 'romanization of formal version' : 'empty string'}`,
        response_json_schema: {
          type: "object",
          properties: {
            phrases: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  english: { type: "string" },
                  formal_translation: { type: "string" },
                  formal_phonetic: { type: "string" },
                  casual_translation: { type: "string" },
                  casual_phonetic: { type: "string" },
                  same_formality: { type: "boolean" },
                  romanization: { type: "string" }
                },
                required: ["english", "formal_translation", "formal_phonetic", "casual_translation", "casual_phonetic", "same_formality"]
              }
            }
          },
          required: ["phrases"]
        }
      });

      const translatedPhrases = result.phrases || presetPhrases.map(p => ({
        english: p, 
        formal_translation: p, 
        formal_phonetic: "", 
        casual_translation: p, 
        casual_phonetic: "",
        same_formality: true,
        romanization: ""
      }));

      setPhrases(prev => ({ ...prev, [categoryId]: translatedPhrases }));
      
      // Save to cache (localStorage + Cloudflare KV for all users)
      await saveCachedPhrases(categoryId, languageCode, translatedPhrases);
      
    } catch (error) {
      console.error(`❌ Translation error for ${categoryId}:`, error);
      const fallbackPhrases = PRESET_PHRASES[categoryId].map(phrase => ({
        english: phrase, 
        formal_translation: phrase, 
        formal_phonetic: "", 
        casual_translation: phrase, 
        casual_phonetic: "",
        same_formality: true,
        romanization: ""
      }));
      setPhrases(prev => ({ ...prev, [categoryId]: fallbackPhrases }));
    }

    setLoadingPhrases(prev => ({ ...prev, [categoryId]: false }));
  };

  // ============================================================================
  // TEXT-TO-SPEECH - Calls Cloudflare Worker for native-sounding audio
  // ============================================================================
  // Clean text for TTS - replace placeholders with pause markers
  const cleanTextForTTS = (text) => {
    // Use a unique placeholder that won't get accidentally modified
    const PAUSE_MARKER = '###PAUSE###';
    
    return text
      // Replace text in square brackets with pause marker: [pointing to object] → pause
      .replace(/\[.*?\]/g, PAUSE_MARKER)
      // Replace underscores used as blanks with pause: _________ → pause
      .replace(/_+/g, PAUSE_MARKER)
      // Clean up multiple spaces
      .replace(/\s+/g, ' ')
      // Clean up multiple consecutive pause markers
      .replace(new RegExp(`(${PAUSE_MARKER}\\s*)+`, 'g'), PAUSE_MARKER)
      // Clean up leftover punctuation issues
      .replace(/\s+\?/g, '?')
      .replace(/\s+,/g, ',')
      // Now convert pause markers to "..." for the worker to process
      .replace(new RegExp(PAUSE_MARKER, 'g'), ' ... ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const speakPhrase = async (text, languageCode, phraseKey, audioUrl = null) => {
    setPlayingAudio(prev => ({ ...prev, [phraseKey]: true }));

    // Pre-seeded Gemini audio (Supabase phrase_translations.audio_formal_url) is
    // the most authentic clip — play it directly. On ANY failure (missing file /
    // network), fall through to the live TTS worker below.
    if (audioUrl) {
      try {
        const a = new Audio(audioUrl);
        a.onended = () => setPlayingAudio(prev => ({ ...prev, [phraseKey]: false }));
        a.onerror = () => setPlayingAudio(prev => ({ ...prev, [phraseKey]: false }));
        await a.play();
        return;
      } catch { /* fall through to TTS worker */ }
    }

    try {
      // Clean the text - remove [brackets], ___underscores___, etc.
      const cleanedText = cleanTextForTTS(text);
      
      if (!cleanedText || cleanedText.length < 2) {
        setPlayingAudio(prev => ({ ...prev, [phraseKey]: false }));
        return;
      }
      
      const ttsCode = getActiveTTSCode();
      const city = activeLocation?.address?.city || '';
      
      // Browser audio cache key (use cleaned text)
      const textHash = btoa(encodeURIComponent(cleanedText + ttsCode)).substring(0, 32);
      const audioKey = `tts_audio_v7_${textHash}`; // v7: Boholano only when selected
      const cachedAudio = localStorage.getItem(audioKey);
      
      // Use browser cached audio if available
      if (cachedAudio) {
        const audio = new Audio(cachedAudio);
        audio.play();
        audio.onended = () => setPlayingAudio(prev => ({ ...prev, [phraseKey]: false }));
        audio.onerror = () => setPlayingAudio(prev => ({ ...prev, [phraseKey]: false }));
        return;
      }
      
      // Call Cloudflare Worker (send cleaned text)
      const response = await fetch(CLOUDFLARE_TTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanedText, languageCode: ttsCode, city })
      });
      
      const data = await response.json();
      
      if (data.error || data.useFallback) {
        throw new Error('Using browser fallback');
      }
      
      const audioContent = `data:audio/mp3;base64,${data.audioContent}`;
      
      // Cache in browser
      try {
        localStorage.setItem(audioKey, audioContent);
      } catch (e) {
        // Storage full - clear old audio
        const keys = Object.keys(localStorage);
        keys.filter(k => k.startsWith('tts_audio_')).slice(0, 50).forEach(k => localStorage.removeItem(k));
      }
      
      const audio = new Audio(audioContent);
      audio.play();
      audio.onended = () => setPlayingAudio(prev => ({ ...prev, [phraseKey]: false }));
      audio.onerror = () => setPlayingAudio(prev => ({ ...prev, [phraseKey]: false }));

    } catch {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = languageCode || 'en';
      utterance.rate = 0.85;
      utterance.onend = () => setPlayingAudio(prev => ({ ...prev, [phraseKey]: false }));
      utterance.onerror = () => setPlayingAudio(prev => ({ ...prev, [phraseKey]: false }));
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleCategoryClick = (categoryId) => {
    if (expandedCategory === categoryId) {
      setExpandedCategory(null);
    } else {
      setExpandedCategory(categoryId);
      if (!phrases[categoryId] && !loadingPhrases[categoryId]) {
        loadCategoryPhrases(categoryId);
      }
    }
  };

  const handleLanguageSelect = (language) => {
    setSelectedTranslationLanguage(language);
    setWantsTranslation(true);
    setShowLanguageDropdown(false);
    setPhrases({});
  };

  const handleDisableTranslation = () => {
    setWantsTranslation(false);
    setSelectedTranslationLanguage(null);
    setShowLanguageDropdown(false);
    setPhrases({});
  };

  // Search functionality
  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      performSearch();
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  }, [searchQuery, phrases]);

  const performSearch = async () => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const results = [];

    // Related search terms mapping
    const relatedTerms = {
      'allergy': ['allergen'],
      'allergen': ['allergy'],
      'bathroom': ['restroom', 'toilet'],
      'restroom': ['bathroom', 'toilet'],
      'toilet': ['bathroom', 'restroom']
    };

    // Load ALL categories (including unexpanded ones) before searching
    const loadPromises = PHRASE_CATEGORIES.map(category => {
      if (!phrases[category.id] && !loadingPhrases[category.id]) {
        return loadCategoryPhrases(category.id);
      }
      return Promise.resolve();
    });
    
    await Promise.all(loadPromises);

    // Build search terms array (original query + related terms)
    const searchTerms = [query];
    if (relatedTerms[query]) {
      searchTerms.push(...relatedTerms[query]);
    }

    // Search through ALL phrases in ALL categories
    for (const category of PHRASE_CATEGORIES) {
      const categoryPhrases = phrases[category.id] || [];
      categoryPhrases.forEach((phrase, index) => {
        const matchFound = searchTerms.some(term => {
          const englishMatch = phrase.english.toLowerCase().includes(term);
          const formalMatch = (phrase.formal_translation || phrase.translation || '').toLowerCase().includes(term);
          const casualMatch = (phrase.casual_translation || '').toLowerCase().includes(term);
          const phoneticMatch = (phrase.formal_phonetic || phrase.phonetic || '').toLowerCase().includes(term);
          const casualPhoneticMatch = (phrase.casual_phonetic || '').toLowerCase().includes(term);
          
          return englishMatch || formalMatch || casualMatch || phoneticMatch || casualPhoneticMatch;
        });
        
        if (matchFound) {
          results.push({
            ...phrase,
            categoryId: category.id,
            categoryName: category.name,
            index
          });
        }
      });
    }

    setSearchResults(results);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
  };

  // ==========================================================================
  // RENDER: the new look
  // ==========================================================================
  const isEnglishOnly = isInEnglishCountry && !wantsTranslation;
  const isReverseMode = !!(isInEnglishCountry && wantsTranslation && selectedTranslationLanguage);
  const mode = isReverseMode ? "reverse" : isEnglishOnly ? "english" : "normal";
  const activeName = getActiveLanguageName();
  // 'Say it in Spanish'; 'Say it in English' for the reverse mode; the world's 'Say it
  // like a local' where the phrases are English or the language is unknown.
  const named = !isEnglishOnly && !isReverseMode && !!languageInfo && activeName !== "English" && activeName !== "Local language";
  const title = isReverseMode ? { pre: "Say it in ", italic: "English", post: "" } : named ? { pre: "Say it in ", italic: activeName, post: "" } : undefined;
  const kickerLanguage = !languageInfo ? null : isReverseMode ? `${selectedTranslationLanguage.name} to English` : activeName;
  const placeName = activeLocation?.address?.city || activeLocation?.placeName || null;
  const locationLabel = locationMode === "navigate" && placeName ? `Planning · ${placeName}` : getLocationLabel(activeLocation);
  const hasOptions = !!languageInfo && (isInEnglishCountry || languageInfo.show_toggle);
  const pillText = isInEnglishCountry ? (isReverseMode ? `${selectedTranslationLanguage.name} → English` : "English") : activeName;
  const notes = [ttsWarning && useDialect ? ttsWarning.message : null, useDialect && languageInfo?.dialect_note ? languageInfo.dialect_note : null].filter(Boolean);
  const noLocation = initialized && !activeLocation?.address;
  const rowProps = { mode, langCode: getActiveLanguageCode(), readCode: selectedTranslationLanguage?.code, ttsCode: getActiveTTSCode(), playingAudio, speak: speakPhrase };
  const pickDialect = (on) => { setUseDialect(on); setPhrases({}); setExpandedCategory(null); setShowLanguageDropdown(false); };
  const pill = { display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44, maxWidth: "100%", boxSizing: "border-box", padding: "0 14px", borderRadius: 999, background: NEUTRAL.white, border: `1px solid ${W.line}`, fontFamily: "inherit", fontSize: fs(14), fontWeight: 600, lineHeight: 1.2, color: W.ink };
  const sectionKicker = { margin: 0, fontFamily: MONO, fontSize: fs(10.5), fontWeight: 500, letterSpacing: ".16em", lineHeight: 1.34, textTransform: "uppercase", color: W.accentText };
  const sectionTitle = { margin: "4px 0 0", fontFamily: SERIF, fontWeight: 400, fontSize: fs(24), lineHeight: 1.12, color: W.ink };

  // A situation (Phrases.dc.html L50-58): the thumb-index tab, ESSENTIAL / USEFUL /
  // PRIORITY, the serif name, the subtitle and a 44px chevron; open, its phrase rows.
  const situation = (category) => {
    const isOpen = expandedCategory === category.id;
    const priority = category.priority === "emergency";
    const panelId = `sit-${category.id}`;
    const list = phrases[category.id] || [];
    return (
      <section key={category.id} aria-label={category.name}
        style={{ position: "relative", overflow: "hidden", borderRadius: 16, background: NEUTRAL.white, border: `1px solid ${W.line}`, gridColumn: isOpen ? "1 / -1" : "auto" }}>
        <button type="button" onClick={() => handleCategoryClick(category.id)} aria-expanded={isOpen} aria-controls={panelId}
          style={{ position: "relative", display: "flex", alignItems: "center", width: "100%", minHeight: 72, boxSizing: "border-box", padding: "9px 8px 9px 44px", background: "transparent", border: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: "inherit" }}>
          <ThumbIndex icon={category.icon} priority={priority} />
          <span style={{ display: "block", flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontFamily: MONO, fontSize: fs(9.5), fontWeight: 500, letterSpacing: ".14em", lineHeight: 1.37, textTransform: "uppercase", color: priority ? NEUTRAL.stamp : W.accentText }}>
              {KICKER[category.priority] || "Useful"}
            </span>
            <span style={{ display: "block", marginTop: 1, fontFamily: SERIF, fontSize: fs(22), lineHeight: 1.1, color: W.ink }}>{category.name}</span>
            <span style={{ display: "block", fontSize: fs(12.5), lineHeight: 1.3, color: NEUTRAL.ink3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{category.subtitle}</span>
          </span>
          <span aria-hidden="true" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, flexShrink: 0 }}>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, boxSizing: "border-box", borderRadius: 999, border: `1px solid ${W.line}` }}>
              <ChevronDown size={16} color={W.ink} strokeWidth={2} style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
            </span>
          </span>
        </button>
        <div id={panelId} hidden={!isOpen}>
          {isOpen ? (
            loadingPhrases[category.id] ? (
              <div style={{ padding: "4px 14px 8px 44px", borderTop: `1px solid ${W.line}` }}>
                <WorldSkeleton world="phrases" variant="row" count={3} label={`Translating to ${activeName}`} />
              </div>
            ) : list.length ? (
              list.map((phrase, index) => <PhraseRow key={index} phrase={phrase} rowKey={`${category.id}_${index}`} {...rowProps} />)
            ) : (
              <p style={{ margin: 0, padding: "14px 14px 14px 44px", borderTop: `1px solid ${W.line}`, fontSize: fs(13.5), lineHeight: 1.45, color: NEUTRAL.ink2 }}>
                No phrases here yet. Try again in a moment.
              </p>
            )
          ) : null}
        </div>
      </section>
    );
  };

  return (
    <div className="font-sans" style={{ background: W.paper, minHeight: "100vh", paddingTop: 12 }}>
      {/* ── THE PLATE (Phrases.dc.html L26-41): no refresh; the place in mono. Under it the
          language pill, one note (the dialect's voice and note) and the search. ── */}
      <FinderHeader
        world="phrases"
        count={null}
        kickerExtras={[kickerLanguage]}
        title={title}
        location={{ label: locationLabel, onChange: () => setShowLocationPicker(true), mono: true }}
      >
        {languageInfo ? (
          hasOptions ? (
            <button type="button" onClick={() => setShowLanguageDropdown(true)} aria-haspopup="dialog" aria-label={`Language: ${pillText}, change`} style={{ ...pill, cursor: "pointer" }}>
              <Languages size={16} color={W.iconInk} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0 }} />
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pillText}</span>
              <ChevronDown size={16} color={W.iconInk} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0 }} />
            </button>
          ) : (
            <span style={pill}>
              <Languages size={16} color={W.iconInk} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0 }} />
              {pillText}
            </span>
          )
        ) : null}
        {notes.length ? (
          <WorldNote world="phrases" icon={ttsWarning && useDialect ? Volume2 : Info} style={{ marginTop: 10 }}>
            {notes.map((n) => <div key={n}>{n}</div>)}
          </WorldNote>
        ) : null}
        <WorldSearch world="phrases" value={searchQuery} onChange={setSearchQuery} onSubmit={() => performSearch()} onClear={clearSearch}
          placeholder="Search words or phrases…" label="Search words or phrases" submitLabel="Search phrases" submitIcon={Search}
          style={{ marginTop: languageInfo || notes.length ? 12 : 0 }} />
      </FinderHeader>

      <div style={{ ...finderColumnStyle(isTablet), paddingBottom: 24 }}>
        {noLocation ? (
          <FinderEmptyState world="phrases" icon={MapPin} title="Choose a location" hint="Pick where you are or where you’re going, and the phrasebook speaks its language."
            actionLabel="Choose a location" onAction={() => setShowLocationPicker(true)} style={{ marginTop: 20 }} />
        ) : isSearching ? (
          searchResults.length ? (
            <section aria-label="Search results" style={{ marginTop: 20 }}>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, padding: "0 2px" }}>
                <div>
                  <p style={sectionKicker}>Search</p>
                  <h2 style={sectionTitle}>{searchResults.length} {searchResults.length === 1 ? "phrase" : "phrases"}</h2>
                </div>
                <button type="button" onClick={clearSearch}
                  style={{ minHeight: 44, padding: "0 4px", background: "transparent", border: 0, fontFamily: "inherit", fontSize: fs(13), fontWeight: 600, color: W.ink, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer" }}>
                  Clear search
                </button>
              </div>
              <div role="list" style={{ marginTop: 10, overflow: "hidden", borderRadius: 16, background: NEUTRAL.white, border: `1px solid ${W.line}` }}>
                {searchResults.map((r, idx) => (
                  <div role="listitem" key={`${r.categoryId}_${r.index}`}>
                    <PhraseRow phrase={r} rowKey={`search_${idx}`} {...rowProps} kicker={r.categoryName} inset={false} first={idx === 0} />
                  </div>
                ))}
              </div>
            </section>
          ) : searchQuery.trim() ? (
            <FinderEmptyState world="phrases" icon={SearchX} title={`Nothing for “${searchQuery.trim()}”`} hint="Try a shorter word, or pick a situation."
              actionLabel="Clear search" onAction={clearSearch} style={{ marginTop: 20 }} />
          ) : null
        ) : (
          <>
            <div style={{ marginTop: 28, padding: "0 2px" }}>
              <p style={sectionKicker}>Phrasebook</p>
              <h2 style={sectionTitle}>Pick a <em style={{ fontStyle: "italic" }}>situation</em></h2>
            </div>
            {loading || !languageInfo ? (
              <WorldSkeleton world="phrases" variant="row" count={6} label="Opening the phrasebook" style={{ marginTop: 14 }} />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: isTablet ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)", gap: isTablet ? 16 : 10, marginTop: 14, alignItems: "start" }}>
                {PHRASE_CATEGORIES.map(situation)}
              </div>
            )}
          </>
        )}
      </div>

      {/* The language sheet: every choice the old language card offered. */}
      <FilterSheet world="phrases" open={showLanguageDropdown} onClose={() => setShowLanguageDropdown(false)} title="Language">
        {isInEnglishCountry ? (
          <>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              <OptionRow title="English only" sub="Phrases in English, read aloud" selected={!wantsTranslation} onClick={handleDisableTranslation} />
            </ul>
            <FilterGroupLabel style={{ marginTop: 18 }}>Translate from another language</FilterGroupLabel>
            <p style={{ margin: "4px 0 6px", fontSize: fs(12.5), lineHeight: 1.4, color: NEUTRAL.ink3 }}>Your language first, then the English to say. The audio plays the English.</p>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {AVAILABLE_LANGUAGES.map((language) => (
                <OptionRow key={language.code} title={language.name}
                  selected={wantsTranslation && selectedTranslationLanguage?.code === language.code} onClick={() => handleLanguageSelect(language)} />
              ))}
            </ul>
          </>
        ) : languageInfo?.show_toggle ? (
          <>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              <OptionRow title={languageInfo.country_language} sub={`Official language of ${languageInfo.country}`} selected={!useDialect} onClick={() => pickDialect(false)} />
              <OptionRow title={languageInfo.city_language} sub={`Local dialect in ${languageInfo.city || "this area"}`} selected={useDialect} onClick={() => pickDialect(true)} />
            </ul>
            {languageInfo.dialect_note ? <p style={{ margin: "12px 0 0", fontSize: fs(12.5), lineHeight: 1.45, color: NEUTRAL.ink2 }}>{languageInfo.dialect_note}</p> : null}
          </>
        ) : null}
      </FilterSheet>

      <LocationModePicker isOpen={showLocationPicker} onClose={() => setShowLocationPicker(false)} />
    </div>
  );
}
