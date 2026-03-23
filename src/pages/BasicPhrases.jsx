/**
 * BasicPhrasesPage - FIXED VERSION with Cloudflare TTS
 * 
 * FIXES:
 * 1. INSTANT LOADING - Uses preset phrases from Word document (no AI generation)
 * 2. NATIVE-SOUNDING TTS - Calls Cloudflare Worker with Neural2 voices
 * 3. CACHING - Browser caches translations (7 days) and audio (permanent)
 * 
 * CLOUDFLARE WORKER URL: https://globeskimmers-tts.maizasimeon.workers.dev
 */

import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, ChevronDown, ChevronUp, Globe, Loader2, Navigation, Volume2, Languages, Search, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "../components/location/LocationContext";
import LocationModePicker from "../components/location/LocationModePicker";

// ============================================================================
// CLOUDFLARE WORKER URL - Your TTS endpoint
// ============================================================================
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

const PHRASE_CATEGORIES = [
  { id: "basics", icon: "🌎", name: "Essential Basics", subtitle: "Polite & general communication", priority: "high" },
  { id: "directions", icon: "🗺️", name: "Finding Your Way", subtitle: "Directions & locations", priority: "high" },
  { id: "transportation", icon: "🚕", name: "Transportation", subtitle: "Taxi, bus, train, airport", priority: "high" },
  { id: "accommodation", icon: "🏨", name: "Hotels & Lodging", subtitle: "Check-in, requests, problems", priority: "high" },
  { id: "shopping", icon: "🛍️", name: "Shopping & Money", subtitle: "Prices, payment, exchange", priority: "high" },
  { id: "grocery", icon: "🛒", name: "Market & Grocery Shopping", subtitle: "Basic food items list", priority: "medium" },
  { id: "allergies", icon: "⚠️", name: "Food Allergies & Dietary Needs", subtitle: "Critical phrases for safe dining", priority: "emergency" },
  { id: "emergencies", icon: "🚨", name: "Emergency Help", subtitle: "Safety, medical, critical assistance", priority: "emergency" },
  { id: "locations", icon: "📍", name: "Key Locations & Services", subtitle: "Where to find things", priority: "medium" },
  { id: "numbers", icon: "🔢", name: "Numbers & Counting", subtitle: "Quantities, dates, clarity", priority: "medium" }
];

const ENGLISH_SPEAKING_COUNTRIES = [
  "United States", "USA", "United Kingdom", "Great Britain", "England",
  "Canada", "Australia", "New Zealand", "Ireland"
];

const AVAILABLE_LANGUAGES = [
  { code: "ar", name: "Arabic", flag: "🇸🇦" },
  { code: "zh", name: "Mandarin Chinese", flag: "🇨🇳" },
  { code: "fr", name: "French", flag: "🇫🇷" },
  { code: "de", name: "German", flag: "🇩🇪" },
  { code: "hi", name: "Hindi", flag: "🇮🇳" },
  { code: "id", name: "Indonesian", flag: "🇮🇩" },
  { code: "it", name: "Italian", flag: "🇮🇹" },
  { code: "ja", name: "Japanese", flag: "🇯🇵" },
  { code: "ko", name: "Korean", flag: "🇰🇷" },
  { code: "ms", name: "Malay", flag: "🇲🇾" },
  { code: "pt", name: "Portuguese", flag: "🇵🇹" },
  { code: "ru", name: "Russian", flag: "🇷🇺" },
  { code: "es", name: "Spanish", flag: "🇪🇸" },
  { code: "tl", name: "Tagalog/Filipino", flag: "🇵🇭" },
  { code: "th", name: "Thai", flag: "🇹🇭" },
  { code: "tr", name: "Turkish", flag: "🇹🇷" },
  { code: "vi", name: "Vietnamese", flag: "🇻🇳" }
];

export default function BasicPhrasesPage() {
  const navigate = useNavigate();
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
      const isAuthenticated = await base44.auth.isAuthenticated();
      if (!isAuthenticated) {
        base44.auth.redirectToLogin(window.location.pathname);
        return;
      }
      const userData = await base44.auth.me();
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
      base44.auth.redirectToLogin(window.location.pathname);
    }
  };

  const detectLanguageAndDialect = async () => {
    if (!activeLocation?.address) {
      console.log('⚠️ No address in activeLocation');
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
    
    console.log(`🗺️ Detecting language for: "${rawCity}" (normalized: "${city}"), ${country}`);
    
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
          console.log(`✅ Matched "${rawCity}" to region "${locationKey}"`);
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
        
        console.log(`📍 Detected: ${matchedCity} → ${dialectInfo.dialect} (${dialectInfo.code})`);
        console.log(`🌍 Country default: ${countryMapping.default_language} (${countryMapping.default_code})`);
        console.log(`🔀 Has different dialect: ${hasDifferentDialect} → Show toggle: ${hasDifferentDialect}`);
        
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
      console.log(`🌍 No city match for "${rawCity}" - Using country default: ${countryMapping.default_language}`);
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
    console.log(`⚠️ No mapping for country: ${country}`);
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

  const getCacheKey = (categoryId, languageCode) => `phrases_v14_${categoryId}_${languageCode}`; // v14: o like oracle

  // Try localStorage first (instant), then Cloudflare KV
  const getCachedPhrases = async (categoryId, languageCode) => {
    const cacheKey = getCacheKey(categoryId, languageCode);
    
    // 1. Check localStorage (instant, per-user, forever)
    try {
      const localCached = localStorage.getItem(cacheKey);
      if (localCached) {
        const data = JSON.parse(localCached);
        if (data.phrases && data.phrases.length > 0) {
          console.log(`✅ localStorage HIT: ${cacheKey}`);
          return data.phrases;
        }
      }
    } catch (e) {
      console.error('localStorage read error:', e);
    }
    
    // 2. Check Cloudflare KV (shared across all users)
    try {
      console.log(`🔍 Checking Cloudflare KV: ${cacheKey}`);
      const response = await fetch(`${CLOUDFLARE_TTS_URL}?action=getTranslation&key=${encodeURIComponent(cacheKey)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.phrases && data.phrases.length > 0) {
          console.log(`✅ Cloudflare KV HIT: ${cacheKey}`);
          // Save to localStorage for faster access next time
          try {
            localStorage.setItem(cacheKey, JSON.stringify({ phrases: data.phrases, timestamp: Date.now() }));
          } catch (e) { /* localStorage full */ }
          return data.phrases;
        }
      }
    } catch (e) {
      console.log('Cloudflare KV check failed:', e);
    }
    
    return null;
  };

  // Save to both localStorage and Cloudflare KV
  const saveCachedPhrases = async (categoryId, languageCode, phrasesData) => {
    const cacheKey = getCacheKey(categoryId, languageCode);
    
    // 1. Save to localStorage (instant access for this user)
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ phrases: phrasesData, timestamp: Date.now() }));
      console.log(`💾 Saved to localStorage: ${cacheKey}`);
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
      }).then(() => {
        console.log(`☁️ Saved to Cloudflare KV: ${cacheKey}`);
      }).catch(e => {
        console.log('Cloudflare KV save failed:', e);
      });
    } catch (e) {
      console.log('Cloudflare KV save error:', e);
    }
  };

  // ============================================================================
  // LOAD PHRASES - Instant for English, cached translations for other languages
  // ============================================================================
  const loadCategoryPhrases = async (categoryId) => {
    if (phrases[categoryId]) {
      console.log(`✅ Already loaded in state: ${categoryId}`);
      return;
    }
    if (!languageInfo) {
      console.log(`⚠️ No language info yet`);
      return;
    }

    const isEnglishOnly = languageInfo.is_english_only_mode || (isInEnglishCountry && !wantsTranslation);
    const languageCode = getActiveLanguageCode();
    const languageName = getActiveLanguageName();

    console.log(`📂 Loading ${categoryId} in ${languageName} (${languageCode})`);

    // English = instant load (no translation needed)
    if (isEnglishOnly || languageCode === 'en') {
      console.log(`⚡ Instant load (English) - from Word document`);
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

    console.log(`❌ No cache found - Translating with AI (one-time)...`);

    // Translate with AI (only happens once per language, then cached globally)
    try {
      const presetPhrases = PRESET_PHRASES[categoryId];
      
      // Determine if we need romanization (non-Latin scripts)
      const needsRomanization = ['ja', 'ko', 'zh', 'zh-CN', 'zh-TW', 'cmn', 'yue', 'yue-HK', 
        'th', 'ar', 'he', 'hi', 'bn', 'ta', 'te', 'kn', 'ml', 'gu', 'pa', 'mr',
        'ru', 'uk', 'el', 'am', 'ka', 'hy'].some(code => 
          languageCode.toLowerCase().startsWith(code)
        );
      
      const result = await base44.integrations.Core.InvokeLLM({
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

      console.log(`✅ AI translated ${translatedPhrases.length} phrases`);
      
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

  const speakPhrase = async (text, languageCode, phraseKey) => {
    try {
      setPlayingAudio(prev => ({ ...prev, [phraseKey]: true }));
      
      // Clean the text - remove [brackets], ___underscores___, etc.
      const cleanedText = cleanTextForTTS(text);
      
      if (!cleanedText || cleanedText.length < 2) {
        console.log('⚠️ No speakable text after cleaning');
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
        console.log('✅ Audio cache HIT');
        const audio = new Audio(cachedAudio);
        audio.play();
        audio.onended = () => setPlayingAudio(prev => ({ ...prev, [phraseKey]: false }));
        audio.onerror = () => setPlayingAudio(prev => ({ ...prev, [phraseKey]: false }));
        return;
      }
      
      console.log(`🔊 Calling Cloudflare TTS: "${cleanedText.substring(0, 50)}..." in ${ttsCode}`);
      console.log(`🔍 Has pause markers (...): ${cleanedText.includes('...')}`);
      
      // Call Cloudflare Worker (send cleaned text)
      const response = await fetch(CLOUDFLARE_TTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanedText, languageCode: ttsCode, city })
      });
      
      const data = await response.json();
      
      if (data.error || data.useFallback) {
        console.log('⚠️ Cloudflare TTS failed, using browser fallback:', data.error);
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
      
      if (data.cached) {
        console.log('✅ Cloudflare KV cache HIT');
      } else {
        console.log(`✅ Generated new audio: ${data.voiceUsed}, ${data.charCount} chars`);
      }
      
    } catch (error) {
      console.log('🔊 Using browser TTS fallback:', error.message);
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

  const renderPhrases = (categoryPhrases) => {
    if (!categoryPhrases || categoryPhrases.length === 0) {
      return <p className="text-sm text-gray-500 p-4">No phrases available</p>;
    }

    const isEnglishOnly = languageInfo?.is_english_only_mode || (isInEnglishCountry && !wantsTranslation);
    const isReverseMode = isInEnglishCountry && wantsTranslation && selectedTranslationLanguage;
    const ttsCode = getActiveTTSCode();

    // Helper to clean phonetic text
    const cleanPhonetic = (text) => {
      if (!text) return '';
      return text
        .replace(/\[.*?\]/g, '')
        .replace(/_+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    // Check if formal and casual are actually different
    const hasDifferentFormality = (phrase) => {
      // If same_formality is explicitly set, use it
      if (phrase.same_formality === true) return false;
      if (phrase.same_formality === false) return true;
      
      // Fallback: compare the actual translations
      const formal = (phrase.formal_translation || '').toLowerCase().trim();
      const casual = (phrase.casual_translation || '').toLowerCase().trim();
      return formal !== casual && casual !== '';
    };

    return (
      <div className="space-y-3 p-3">
        {categoryPhrases.map((phrase, index) => {
          const showBothVersions = hasDifferentFormality(phrase);
          
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02 }}
              className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"
            >
              {isReverseMode ? (
                // Reverse mode: User in English country, wants to see their native language
                <>
                  <p className="text-sm text-gray-600 mb-1">{phrase.formal_translation || phrase.translation}</p>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-base font-bold text-[#088395]">{phrase.english}</p>
                    </div>
                    <button
                      onClick={() => speakPhrase(phrase.english, 'en', `${expandedCategory}_${index}`)}
                      className={`flex-shrink-0 p-2 rounded-full ${
                        playingAudio[`${expandedCategory}_${index}`]
                          ? 'bg-[#088395] text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      disabled={playingAudio[`${expandedCategory}_${index}`]}
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                </>
              ) : (
                // Normal mode: User traveling, needs local language
                <>
                  {/* English phrase */}
                  <p className="text-sm text-gray-600 mb-3">{phrase.english}</p>
                  
                  {!isEnglishOnly && (phrase.formal_translation || phrase.translation) && (
                    <div className="space-y-3">
                      
                      {/* SINGLE VERSION - When formal and casual are the same */}
                      {!showBothVersions && (
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-base font-bold text-[#088395]">
                              {phrase.formal_translation || phrase.translation}
                            </p>
                            
                            {/* Phonetic */}
                            {(phrase.formal_phonetic || phrase.phonetic) && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                                  Say it:
                                </span>
                                <p className="text-sm text-amber-700">
                                  {cleanPhonetic(phrase.formal_phonetic || phrase.phonetic)}
                                </p>
                              </div>
                            )}
                            
                            {/* Romanization */}
                            {phrase.romanization && (
                              <p className="text-xs text-gray-500 italic mt-1">
                                Romanized: {phrase.romanization}
                              </p>
                            )}
                          </div>
                          
                          {/* Speaker button */}
                          <button
                            onClick={() => speakPhrase(phrase.formal_translation || phrase.translation, ttsCode, `${expandedCategory}_${index}`)}
                            className={`flex-shrink-0 p-2.5 rounded-full transition-all ${
                              playingAudio[`${expandedCategory}_${index}`]
                                ? 'bg-[#088395] text-white animate-pulse'
                                : 'bg-gray-100 text-gray-600 hover:bg-[#E0F7FA] hover:text-[#088395]'
                            }`}
                            disabled={playingAudio[`${expandedCategory}_${index}`]}
                            title="Listen to pronunciation"
                          >
                            <Volume2 className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                      
                      {/* TWO VERSIONS - When formal and casual are different */}
                      {showBothVersions && (
                        <>
                          {/* FORMAL / POLITE VERSION */}
                          <div className="bg-gradient-to-r from-[#E8F5E9] to-[#F1F8E9] rounded-lg p-3 border border-green-200">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full font-medium">
                                    Formal / Polite
                                  </span>
                                </div>
                                <p className="text-base font-bold text-green-800">
                                  {phrase.formal_translation || phrase.translation}
                                </p>
                                
                                {/* Formal phonetic */}
                                {(phrase.formal_phonetic || phrase.phonetic) && (
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <span className="text-xs text-green-600 font-medium">Say it:</span>
                                    <p className="text-sm text-green-700">
                                      {cleanPhonetic(phrase.formal_phonetic || phrase.phonetic)}
                                    </p>
                                  </div>
                                )}
                                
                                {/* Romanization */}
                                {phrase.romanization && (
                                  <p className="text-xs text-green-600/70 italic mt-1">
                                    Romanized: {phrase.romanization}
                                  </p>
                                )}
                              </div>
                              
                              {/* Speaker button for formal */}
                              <button
                                onClick={() => speakPhrase(phrase.formal_translation || phrase.translation, ttsCode, `${expandedCategory}_${index}_formal`)}
                                className={`flex-shrink-0 p-2.5 rounded-full transition-all ${
                                  playingAudio[`${expandedCategory}_${index}_formal`]
                                    ? 'bg-green-600 text-white animate-pulse'
                                    : 'bg-white text-green-600 hover:bg-green-50 border border-green-300'
                                }`}
                                disabled={playingAudio[`${expandedCategory}_${index}_formal`]}
                                title="Listen to formal pronunciation"
                              >
                                <Volume2 className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                          
                          {/* CASUAL VERSION */}
                          <div className="bg-gradient-to-r from-[#FFF3E0] to-[#FFF8E1] rounded-lg p-3 border border-orange-200">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full font-medium">
                                    Casual
                                  </span>
                                </div>
                                <p className="text-base font-bold text-orange-800">
                                  {phrase.casual_translation || phrase.formal_translation || phrase.translation}
                                </p>
                                
                                {/* Casual phonetic */}
                                {(phrase.casual_phonetic || phrase.formal_phonetic || phrase.phonetic) && (
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <span className="text-xs text-orange-600 font-medium">Say it:</span>
                                    <p className="text-sm text-orange-700">
                                      {cleanPhonetic(phrase.casual_phonetic || phrase.formal_phonetic || phrase.phonetic)}
                                    </p>
                                  </div>
                                )}
                              </div>
                              
                              {/* Speaker button for casual */}
                              <button
                                onClick={() => speakPhrase(phrase.casual_translation || phrase.formal_translation || phrase.translation, ttsCode, `${expandedCategory}_${index}_casual`)}
                                className={`flex-shrink-0 p-2.5 rounded-full transition-all ${
                                  playingAudio[`${expandedCategory}_${index}_casual`]
                                    ? 'bg-orange-500 text-white animate-pulse'
                                    : 'bg-white text-orange-500 hover:bg-orange-50 border border-orange-300'
                                }`}
                                disabled={playingAudio[`${expandedCategory}_${index}_casual`]}
                                title="Listen to casual pronunciation"
                              >
                                <Volume2 className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  
                  {/* English only mode */}
                  {isEnglishOnly && (
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={() => speakPhrase(phrase.english, 'en', `${expandedCategory}_${index}`)}
                        className={`p-2 rounded-full ${
                          playingAudio[`${expandedCategory}_${index}`]
                            ? 'bg-[#088395] text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        disabled={playingAudio[`${expandedCategory}_${index}`]}
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                      <span className="text-xs text-gray-400">Tap to hear</span>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#D8F3FF] to-[#FFFFFF] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-[#088395] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#D8F3FF] to-[#FFFFFF]">
      <div className="bg-gradient-to-r from-[#00BCD4] to-[#088395] px-4 py-6">
        <button
          onClick={() => navigate(createPageUrl("Home"))}
          className="mb-3 flex items-center gap-2 text-white/90 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back to Home</span>
        </button>
        <h1 className="text-2xl font-bold text-white mb-1">Basic Phrases</h1>
        <p className="text-sm text-white/80">Essential phrases for your travels</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#E0F7FA] flex items-center justify-center">
                <Navigation className="w-6 h-6 text-[#088395]" />
              </div>
              <div>
                <p className="font-bold text-gray-900">
                  {activeLocation?.placeName || activeLocation?.address?.city}
                </p>
                <p className="text-sm text-gray-600">
                  {activeLocation?.address?.city}, {activeLocation?.address?.country}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowLocationPicker(true)}
              className="text-sm font-semibold text-[#00BCD4] hover:text-[#088395] transition-colors px-4 py-2 rounded-lg border border-[#00BCD4]"
            >
              Change
            </button>
          </div>
        </div>

        {languageInfo && (
          <div className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-5 h-5 text-[#088395]" />
              <p className="font-bold text-gray-900">
                {languageInfo.is_english_only_mode 
                  ? "Language: English" 
                  : `Translating to: ${useDialect ? languageInfo.city_language : languageInfo.country_language}`
                }
              </p>
            </div>

            {/* TTS Warning for dialects using fallback voice */}
            {ttsWarning && useDialect && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 flex items-start gap-2">
                <Languages className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">{ttsWarning.message}</p>
              </div>
            )}

            {/* English-speaking country - user is also English speaker */}
            {languageInfo.is_english_only_mode && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-800">✓ English-speaking location. Phrases shown in English.</p>
              </div>
            )}

            {/* English-speaking country - user wants to translate to their language */}
            {isInEnglishCountry && !languageInfo.is_english_only_mode && (
              <div className="space-y-3">
                {wantsTranslation && selectedTranslationLanguage ? (
                  <div className="bg-[#E0F7FA] border border-[#00BCD4]/30 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-[#088395]">
                        ✓ Showing <strong>{selectedTranslationLanguage.flag} {selectedTranslationLanguage.name}</strong> translations
                      </p>
                      <button onClick={handleDisableTranslation} className="text-xs text-gray-500 hover:text-gray-700 underline">
                        Show English only
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => setShowLanguageDropdown(!showLanguageDropdown)} 
                    className="w-full px-4 py-2.5 bg-white border border-[#088395] text-[#088395] hover:bg-[#E0F7FA] rounded-lg font-medium flex items-center justify-center gap-2"
                  >
                    <Languages className="w-4 h-4" />
                    Translate to another language
                  </button>
                )}
                
                <AnimatePresence>
                  {showLanguageDropdown && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto space-y-1">
                        {AVAILABLE_LANGUAGES.map(language => (
                          <button key={language.code} onClick={() => handleLanguageSelect(language)}
                            className="w-full px-3 py-2 text-left hover:bg-white rounded-lg flex items-center gap-2 text-sm">
                            <span>{language.flag}</span>
                            <span>{language.name}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Non-English country WITH dialect options - show toggle */}
            {!isInEnglishCountry && languageInfo.show_toggle && (
              <div className="space-y-3">
                <p className="text-xs text-gray-600 font-medium uppercase tracking-wide">Choose language:</p>
                
                {/* Two-option toggle */}
                <div className="grid grid-cols-1 gap-2">
                  {/* Country's main language option */}
                  <button 
                    onClick={() => { 
                      console.log('🔀 Switching to country language:', languageInfo.country_language);
                      setUseDialect(false); 
                      setPhrases({}); 
                      setExpandedCategory(null);
                    }}
                    className={`w-full py-3 px-4 rounded-xl text-left transition-all flex items-center gap-3 ${
                      !useDialect 
                        ? 'bg-[#088395] text-white shadow-md ring-2 ring-[#088395] ring-offset-2' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                    }`}
                  >
                    <span className="text-2xl">{languageInfo.country_flag || '🌍'}</span>
                    <div className="flex-1">
                      <p className={`font-semibold ${!useDialect ? 'text-white' : 'text-gray-900'}`}>
                        {languageInfo.country_language}
                      </p>
                      <p className={`text-xs ${!useDialect ? 'text-white/80' : 'text-gray-500'}`}>
                        Official language of {languageInfo.country}
                      </p>
                    </div>
                    {!useDialect && <span className="text-white text-lg">✓</span>}
                  </button>
                  
                  {/* City/Regional dialect option */}
                  <button 
                    onClick={() => { 
                      console.log('🔀 Switching to city dialect:', languageInfo.city_language);
                      setUseDialect(true); 
                      setPhrases({}); 
                      setExpandedCategory(null);
                    }}
                    className={`w-full py-3 px-4 rounded-xl text-left transition-all flex items-center gap-3 ${
                      useDialect 
                        ? 'bg-[#088395] text-white shadow-md ring-2 ring-[#088395] ring-offset-2' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                    }`}
                  >
                    <span className="text-2xl">📍</span>
                    <div className="flex-1">
                      <p className={`font-semibold ${useDialect ? 'text-white' : 'text-gray-900'}`}>
                        {languageInfo.city_language}
                      </p>
                      <p className={`text-xs ${useDialect ? 'text-white/80' : 'text-gray-500'}`}>
                        Local dialect in {languageInfo.city || 'this area'}
                      </p>
                    </div>
                    {useDialect && <span className="text-white text-lg">✓</span>}
                  </button>
                </div>
                
                {/* Dialect note if available */}
                {languageInfo.dialect_note && useDialect && (
                  <p className="text-xs text-gray-500 italic px-1">
                    ℹ️ {languageInfo.dialect_note}
                  </p>
                )}
              </div>
            )}

            {/* Non-English country WITHOUT dialect options - just show the language */}
            {!isInEnglishCountry && !languageInfo.show_toggle && (
              <div className="bg-[#E0F7FA] border border-[#00BCD4]/30 rounded-lg p-3 flex items-center gap-3">
                <span className="text-2xl">{languageInfo.country_flag || '🌍'}</span>
                <div>
                  <p className="text-sm font-medium text-[#088395]">
                    {languageInfo.city_language || languageInfo.country_language}
                  </p>
                  <p className="text-xs text-[#088395]/70">
                    Phrases will be translated to this language
                  </p>
                </div>
              </div>
            )}
            </div>
            )}

            {/* Search Bar */}
            <div className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for words or phrases..."
                  className="w-full pl-10 pr-20 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#088395] focus:border-transparent text-sm"
                />
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                  {searchQuery && (
                    <button
                      onClick={clearSearch}
                      className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <X className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                  )}
                  <button
                    onClick={performSearch}
                    className="p-1.5 bg-[#088395] hover:bg-[#06BCC1] rounded-lg transition-colors"
                  >
                    <Search className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
              </div>
            </div>

            {/* Search Results */}
            {isSearching && searchResults.length > 0 && (
            <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-700">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
              </p>
              <button
                onClick={clearSearch}
                className="flex items-center gap-1 text-sm text-[#088395] hover:text-[#06BCC1] font-semibold"
              >
                <X className="w-4 h-4" />
                Clear
              </button>
            </div>

            <div className="space-y-3">
              {searchResults.map((result, idx) => {
                const showBothVersions = result.formal_translation !== result.casual_translation && result.casual_translation && !result.same_formality;
                const cleanPhonetic = (text) => {
                  if (!text) return '';
                  return text.replace(/\[.*?\]/g, '').replace(/_+/g, '').replace(/\s+/g, ' ').trim();
                };
                const ttsCode = getActiveTTSCode();

                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm text-gray-600 flex-1">{result.english}</p>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full ml-2">
                        {result.categoryName}
                      </span>
                    </div>

                    {!showBothVersions ? (
                      // Single version
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-base font-bold text-[#088395]">
                            {result.formal_translation || result.translation}
                          </p>
                          {(result.formal_phonetic || result.phonetic) && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                                Say it:
                              </span>
                              <p className="text-sm text-amber-700">
                                {cleanPhonetic(result.formal_phonetic || result.phonetic)}
                              </p>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => speakPhrase(result.formal_translation || result.translation, ttsCode, `search_${idx}`)}
                          className={`flex-shrink-0 p-2.5 rounded-full transition-all ${
                            playingAudio[`search_${idx}`]
                              ? 'bg-[#088395] text-white animate-pulse'
                              : 'bg-gray-100 text-gray-600 hover:bg-[#E0F7FA] hover:text-[#088395]'
                          }`}
                          disabled={playingAudio[`search_${idx}`]}
                        >
                          <Volume2 className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      // Both formal and casual
                      <div className="space-y-2">
                        <div className="bg-gradient-to-r from-[#E8F5E9] to-[#F1F8E9] rounded-lg p-2 border border-green-200">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full font-medium">
                                Formal
                              </span>
                              <p className="text-sm font-bold text-green-800 mt-1">
                                {result.formal_translation}
                              </p>
                              {result.formal_phonetic && (
                                <p className="text-xs text-green-700 mt-0.5">
                                  {cleanPhonetic(result.formal_phonetic)}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => speakPhrase(result.formal_translation, ttsCode, `search_${idx}_formal`)}
                              className={`flex-shrink-0 p-2 rounded-full ${
                                playingAudio[`search_${idx}_formal`]
                                  ? 'bg-green-600 text-white'
                                  : 'bg-white text-green-600 hover:bg-green-50'
                              }`}
                              disabled={playingAudio[`search_${idx}_formal`]}
                            >
                              <Volume2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="bg-gradient-to-r from-[#FFF3E0] to-[#FFF8E1] rounded-lg p-2 border border-orange-200">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full font-medium">
                                Casual
                              </span>
                              <p className="text-sm font-bold text-orange-800 mt-1">
                                {result.casual_translation}
                              </p>
                              {result.casual_phonetic && (
                                <p className="text-xs text-orange-700 mt-0.5">
                                  {cleanPhonetic(result.casual_phonetic)}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => speakPhrase(result.casual_translation, ttsCode, `search_${idx}_casual`)}
                              className={`flex-shrink-0 p-2 rounded-full ${
                                playingAudio[`search_${idx}_casual`]
                                  ? 'bg-orange-500 text-white'
                                  : 'bg-white text-orange-500 hover:bg-orange-50'
                              }`}
                              disabled={playingAudio[`search_${idx}_casual`]}
                            >
                              <Volume2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
            </div>
            )}

            {isSearching && searchResults.length === 0 && searchQuery.trim() && (
            <div className="bg-gray-50 rounded-xl p-6 mb-4 text-center">
            <p className="text-gray-600">No results found for "{searchQuery}"</p>
            <button
              onClick={clearSearch}
              className="mt-2 text-sm text-[#088395] hover:text-[#06BCC1] font-semibold"
            >
              Clear search
            </button>
            </div>
            )}

            {!isSearching && (
            <div className="space-y-3">
          {PHRASE_CATEGORIES.map((category) => (
            <div key={category.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden ${category.priority === 'emergency' ? 'border-red-200' : 'border-gray-100'}`}>
              <button onClick={() => handleCategoryClick(category.id)} className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{category.icon}</span>
                  <div className="text-left">
                    <p className="font-bold text-gray-900">{category.name}</p>
                    <p className="text-xs text-gray-600">{category.subtitle}</p>
                  </div>
                </div>
                {expandedCategory === category.id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </button>

              <AnimatePresence>
                {expandedCategory === category.id && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                    {loadingPhrases[category.id] ? (
                      <div className="p-8 flex flex-col items-center">
                        <Loader2 className="w-6 h-6 text-[#088395] animate-spin mb-2" />
                        <p className="text-sm text-gray-600">Translating to {getActiveLanguageName()}...</p>
                      </div>
                    ) : renderPhrases(phrases[category.id])}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            ))}
            </div>
            )}
            </div>

            <LocationModePicker isOpen={showLocationPicker} onClose={() => setShowLocationPicker(false)} />

            {/* Floating Close Button - appears when category is expanded */}
            {expandedCategory && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => {
                  setExpandedCategory(null);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="fixed bottom-24 right-6 w-10 h-10 bg-white/50 backdrop-blur-sm rounded-full shadow-lg border border-gray-200/50 flex items-center justify-center hover:bg-white/70 transition-all z-40"
                aria-label="Close category and scroll to top"
              >
                <X className="w-4 h-4 text-gray-600" />
              </motion.button>
            )}
    </div>
  );
}