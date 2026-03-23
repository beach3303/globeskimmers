/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import ATMFinder from './pages/ATMFinder';
import ActivityDetail from './pages/ActivityDetail';
import AdminDashboard from './pages/AdminDashboard';
import BasicPhrases from './pages/BasicPhrases';
import CoffeeFinder from './pages/CoffeeFinder';
import ConvenienceStore from './pages/ConvenienceStore';
import CultureInformation from './pages/CultureInformation';
import GenerateIcon from './pages/GenerateIcon';
import Home from './pages/Home';
import Map from './pages/Map';
import MoneyExchange from './pages/MoneyExchange';
import Onboarding from './pages/Onboarding';
import PlacesToEat from './pages/PlacesToEat';
import RestroomFinder from './pages/RestroomFinder';
import SavedLocations from './pages/SavedLocations';
import Settings from './pages/Settings';
import Shopping from './pages/Shopping';
import SmartPriceScanner from './pages/SmartPriceScanner';
import SmartTextScanner from './pages/SmartTextScanner';
import TestAPI from './pages/TestAPI';
import ThingsToDo from './pages/ThingsToDo';
import Transportation from './pages/Transportation';
import Weather from './pages/Weather';
import __Layout from './Layout.jsx';


export const PAGES = {
    "ATMFinder": ATMFinder,
    "ActivityDetail": ActivityDetail,
    "AdminDashboard": AdminDashboard,
    "BasicPhrases": BasicPhrases,
    "CoffeeFinder": CoffeeFinder,
    "ConvenienceStore": ConvenienceStore,
    "CultureInformation": CultureInformation,
    "GenerateIcon": GenerateIcon,
    "Home": Home,
    "Map": Map,
    "MoneyExchange": MoneyExchange,
    "Onboarding": Onboarding,
    "PlacesToEat": PlacesToEat,
    "RestroomFinder": RestroomFinder,
    "SavedLocations": SavedLocations,
    "Settings": Settings,
    "Shopping": Shopping,
    "SmartPriceScanner": SmartPriceScanner,
    "SmartTextScanner": SmartTextScanner,
    "TestAPI": TestAPI,
    "ThingsToDo": ThingsToDo,
    "Transportation": Transportation,
    "Weather": Weather,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};