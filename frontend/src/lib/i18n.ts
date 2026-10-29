import phraseAm from "./locales/am.json";
import phraseOm from "./locales/om.json";
import phraseTi from "./locales/ti.json";
import keyTranslationsTi from "./locales/keys-ti.json";
import extraPhrases from "./locales/extra.json";

export type SupportedLang = "en" | "am" | "om" | "ti";

export interface LanguageInfo {
  code: SupportedLang;
  name: string;
  nativeName: string;
  flag: string;
  fontClass?: string;
}

export const LANGUAGES: LanguageInfo[] = [
  {
    code: "en",
    name: "English",
    nativeName: "English",
    flag: "🇬🇧",
  },
  {
    code: "am",
    name: "Amharic",
    nativeName: "አማርኛ",
    flag: "🇪🇹",
    fontClass: "font-ethiopic",
  },
  {
    code: "om",
    name: "Afaan Oromoo",
    nativeName: "Afaan Oromoo",
    flag: "🇪🇹",
  },
  {
    code: "ti",
    name: "Tigrinya",
    nativeName: "ትግርኛ",
    flag: "🇪🇹",
    fontClass: "font-ethiopic",
  },
];

export const translations: Record<SupportedLang, Record<string, string>> = {
  en: {
    // Navigation
    "nav.home": "Home",
    "nav.explore": "Explore",
    "nav.categories": "Categories",
    "nav.places": "Nearby Places",
    "nav.events": "Events",
    "nav.meetups": "Meetups",
    "nav.sports": "Sport",
    "nav.cinema": "Cinema",
    "nav.theatre": "Theatre",
    "nav.quiz": "Lets Know Ethiopia",
    "nav.jokes": "Joke Time",
    "nav.messages": "Messages",
    "nav.notifications": "Notifications",
    "nav.bookmarks": "Bookmarks",
    "nav.profile": "Your profile",
    "nav.settings": "Settings",
    "nav.admin": "Admin dashboard",
    "nav.signIn": "Sign in",
    "nav.join": "Join",
    "nav.signOut": "Sign out",
    "nav.post": "Post",
    "nav.search": "Search",
    "nav.searchPlaceholder": "Search films, books, trails, people…",

    // Nearby / Places page
    "places.badge": "Nearby",
    "places.title": "Places worth leaving the house for.",
    "places.subtitle": "Cinemas, stages, hotels, trailheads, gyms, galleries and coffee worth the detour — plus the hospitals, pharmacies, fuel stations, schools, public toilets, parking, EV chargers, transit stops, banks and ATMs you actually need — sorted by what is closest to you.",
    "places.everything": "Everything",
    "places.saved": "Saved",
    "places.liveOpenMap": "Live OpenMap",
    "places.syncOpenMap": "Sync OpenMap",
    "places.syncing": "Syncing…",
    "places.searchPlaceholder": "Search places…",
    "places.allCities": "All cities",
    "places.sortTopRated": "Top rated",
    "places.sortNearest": "Nearest first",
    "places.sortName": "A – Z",
    "places.nearMe": "Near me",
    "places.pickArea": "Pick area",
    "places.approx": "approx.",
    "places.close": "Close",
    "places.chooseArea": "Choose your area…",
    "places.areaHelp": "No GPS? Pick the area you're in — distances are measured from the middle of it.",
    "places.insecureLocation": "Phones only share GPS over HTTPS. Pick your area and we'll sort by distance from there.",
    "places.useMyLocation": "Use my location",
    "places.findingYou": "Finding you…",
    "places.clearFilters": "Clear filters",
    "places.match": "place match",
    "places.matches": "places match",
    "places.sortedFromYou": "sorted from where you are",
    "places.emptyTitle": "Nothing here yet",
    "places.emptyDesc": "No place matches those filters. Try a different kind of stop, or clear the search.",
    "places.browseAll": "Browse all places",
    "places.liveOsmSyncEnabled": "OpenStreetMap live sync",
    "places.directions": "Directions",
    "places.seePlace": "See the place",
    "places.disclaimer": "Pins are neighbourhood-level. Always check opening hours before you go.",

    // Events & Meetups
    "events.badge": "Gatherings & Meetups",
    "events.title": "Real-world meetups, cinema nights & trail hikes.",
    "events.subtitle": "Connect beyond the screen. RSVP to community gatherings, outdoor hikes, film discussions, and coffee ceremonies.",
    "events.create": "Schedule a Meetup",
    "events.upcoming": "Upcoming Meetups",
    "events.all": "All Events",
    "events.searchPlaceholder": "Search events by title, place or host…",
    "events.going": "Going",
    "events.interested": "Interested",
    "events.attendees": "attending",
    "events.host": "Hosted by",
    "events.venue": "Venue",
    "events.room": "Room",
    "events.maxAttendees": "spots limit",
    "events.emptyTitle": "No upcoming events found",
    "events.emptyDesc": "Be the first to schedule a coffee chat, film screening, or weekend hike!",
    "events.modalTitle": "Schedule a Community Meetup",
    "events.titleLabel": "Event Title",
    "events.titlePlaceholder": "e.g. Sunday Morning Entoto Peak Hike",
    "events.descLabel": "Description",
    "events.descPlaceholder": "Where to meet, what to bring, and what to expect…",
    "events.dateTime": "Date & Time",
    "events.locationLabel": "Meeting Point / Address",
    "events.locationPlaceholder": "e.g. Entoto Park Main Gate, Addis Ababa",
    "events.linkPlace": "Link to a Place (optional)",
    "events.linkRoom": "Associated Room (optional)",
    "events.coverUrlLabel": "Cover Image URL",
    "events.submit": "Publish Meetup",
    "events.submitting": "Publishing…",
    "events.deleteConfirm": "Are you sure you want to cancel this event?",

    // Categories / Rooms
    "room.coffeeTalk": "Coffee Talk",
    "room.sportsTalk": "Sports Talk",
    "room.whatsNew": "What's New",
    "room.ethiopianCinema": "Ethiopian Cinema",
    "room.bookReviews": "Book Reviews",
    "room.hikingExperiences": "Hiking Experiences",
    "room.music": "Music",
    "room.physicalExercise": "Physical Exercise",
    "room.painting": "Painting",
    "room.travel": "Travel",
    "room.lifeStories": "Life Stories & Experiences",

    // Place Kinds
    "kind.cinema": "Cinema",
    "kind.theatre": "Theatre",
    "kind.hotel": "Hotel",
    "kind.hiking": "Hiking",
    "kind.cafe": "Café",
    "kind.restaurant": "Restaurant",
    "kind.gym": "Gym",
    "kind.stadium": "Stadium",
    "kind.gallery": "Gallery",
    "kind.library": "Library",
    "kind.hospital": "Hospital",
    "kind.pharmacy": "Pharmacy",
    "kind.gas_station": "Fuel station",
    "kind.school": "School",

    // Common / UI
    "common.theme": "Theme",
    "common.light": "Light",
    "common.dark": "Dark",
    "common.system": "System",
    "common.switchTheme": "theme",
    "common.language": "Language",
    "common.selectLanguage": "Select language",
    "common.hotInHub": "Hot in the hub",
    "common.coffeeToast": "Every good table starts with a cup and a story. Pull up a chair.",
    "common.bunaTetu": "Have some coffee",
    "common.joinCommunity": "Join a community that talks about films, books, trails and everyday life.",
  },

  am: {
    // Navigation
    "nav.home": "መነሻ",
    "nav.explore": "አስስ",
    "nav.categories": "ክፍሎች",
    "nav.places": "አቅራቢያ ቦታዎች",
    "nav.events": "ዝግጅቶች",
    "nav.meetups": "ስብሰባዎች",
    "nav.sports": "ስፖርት",
    "nav.cinema": "ሲኒማ",
    "nav.theatre": "ቲያትር",
    "nav.quiz": "ኢትዮጵያን እናውቃት",
    "nav.jokes": "የቀልድ ሰዓት",
    "nav.messages": "መልዕክቶች",
    "nav.notifications": "ማሳወቂያዎች",
    "nav.bookmarks": "የተቀመጡ",
    "nav.profile": "መገለጫዬ",
    "nav.settings": "ቅንብሮች",
    "nav.admin": "የአስተዳዳሪ ዳሽቦርድ",
    "nav.signIn": "ግባ",
    "nav.join": "ተመዝገብ",
    "nav.signOut": "ውጣ",
    "nav.post": "አጋራ",
    "nav.search": "ፈልግ",
    "nav.searchPlaceholder": "ፊልሞችን፣ መጻሕፍትን፣ የእግር ጉዞዎችን፣ ሰዎችን ፈልግ…",

    // Nearby / Places page
    "places.badge": "አቅራቢያ",
    "places.title": "ከቤት ወጥቶ ለመጎብኘት የሚገቡ ቦታዎች።",
    "places.subtitle": "ሲኒማ ቤቶች፣ ቲያትሮች፣ ሆቴሎች፣ ጂሞች፣ ጋለሪዎች እና ማኪያቶ የሚጠጡባቸው ምርጥ ቦታዎች — እንዲሁም ሆስፒታሎች፣ ፋርማሲዎች፣ የነዳጅ ማደያዎች፣ ትምህርት ቤቶች፣ ሕዝባዊ ሽንት ቤቶች፣ የመኪና ማቆሚያዎች፣ የኤሌክትሪክ መኪና መሙያዎች፣ የሕዝብ ማመላለሻ ማቆሚያዎች፣ ባንኮች እና ኤቲኤም — በአቅራቢያዎ ተለይተው የቀረቡ።",
    "places.everything": "ሁሉንም",
    "places.saved": "የተቀመጡ",
    "places.liveOpenMap": "የቀጥታ ካርታ",
    "places.syncOpenMap": "ካርታ አድስ",
    "places.syncing": "በማደስ ላይ…",
    "places.searchPlaceholder": "ቦታዎችን ፈልግ…",
    "places.allCities": "ሁሉም ከተሞች",
    "places.sortTopRated": "ከፍተኛ ደረጃ የተሰጣቸው",
    "places.sortNearest": "በጣም የቀረቡ",
    "places.sortName": "ከ ሀ – ፖ",
    "places.nearMe": "አቅራቢያዬ",
    "places.pickArea": "አካባቢ ምረጥ",
    "places.approx": "ግምታዊ",
    "places.close": "ዝጋ",
    "places.chooseArea": "የሚገኙበትን አካባቢ ይምረጡ…",
    "places.areaHelp": "ጂፒኤስ ከሌለ፣ የሚገኙበትን አካባቢ ይምረጡ — ርቀቱ ከአካባቢው መሃል ይሰላል።",
    "places.insecureLocation": "ስልኮች ጂፒኤስ የሚያጋሩት በHTTPS ብቻ ነው። አካባቢ ይምረጡ፤ ከዚያ በርቀት እናዘጋጃለን።",
    "places.useMyLocation": "የአሁኑን አካባቢዬን ተጠቀም",
    "places.findingYou": "አካባቢዎን በመፈለግ ላይ…",
    "places.clearFilters": "ማጣሪያዎችን አጽዳ",
    "places.match": "ቦታ ተገኝቷል",
    "places.matches": "ቦታዎች ተገኝተዋል",
    "places.sortedFromYou": "ከእርስዎ አካባቢ ባለው ርቀት ተደርድረዋል",
    "places.emptyTitle": "እስካሁን ምንም አልተገኘም",
    "places.emptyDesc": "በዚህ ፍለጋ የሚስማማ ቦታ አልተገኘም። እባክዎ ፍለጋዎን ይቀይሩ ወይም ማጣሪያዎችን ያጽዱ።",
    "places.browseAll": "ሁሉንም ቦታዎች ይመልከቱ",
    "places.liveOsmSyncEnabled": "የኦፕንስትሪትማፕ ቀጥታ ግንኙነት ነቅቷል",
    "places.directions": "አቅጣጫ አሳይ",
    "places.seePlace": "ቦታውን እይ",
    "places.disclaimer": "የቦታ አመልካቾች በአካባቢ ደረጃ ናቸው። ከመሄድዎ በፊት የስራ ሰዓቱን ያረጋግጡ።",

    // Events & Meetups
    "events.badge": "ዝግጅቶች እና ስብሰባዎች",
    "events.title": "የቀጥታ ስብሰባዎች፣ የሲኒማ ምሽቶች እና የተራራ ጉዞዎች።",
    "events.subtitle": "ከስክሪኑ ባሻገር ይገናኙ። ለማህበረሰብ ስብሰባዎች፣ የእግር ጉዞዎች፣ የፊልም ውይይቶች እና የቡና ፕሮግራሞች ላይ ይሳተፉ።",
    "events.create": "ዝግጅት አዘጋጅ",
    "events.upcoming": "የሚመጡ ዝግጅቶች",
    "events.all": "ሁሉም ዝግጅቶች",
    "events.searchPlaceholder": "ዝግጅቶችን በርዕስ፣ በቦታ ወይም በአዘጋጅ ፈልግ…",
    "events.going": "እገኛለሁ",
    "events.interested": "ፍላጎት አለኝ",
    "events.attendees": "ተሳታፊዎች",
    "events.host": "አዘጋጅ",
    "events.venue": "የሚካሄድበት ቦታ",
    "events.room": "ክፍል",
    "events.maxAttendees": "የሰው ገደብ",
    "events.emptyTitle": "ምንም የተመዘገበ ዝግጅት የለም",
    "events.emptyDesc": "የቡና ወይም የእግር ጉዞ ዝግጅት ለመክፈት የመጀመሪያው ይሁኑ!",
    "events.modalTitle": "አዲስ የማህበረሰብ ዝግጅት ያዘጋጁ",
    "events.titleLabel": "የዝግጅቱ ርዕስ",
    "events.titlePlaceholder": "ለምሳሌ፦ የእሁድ ጠዋት የእንጦጦ ተራራ የእግር ጉዞ",
    "events.descLabel": "ዝርዝር መግለጫ",
    "events.descPlaceholder": "መገናኛ ቦታ፣ የሚያስፈልጉ ነገሮች እና አጠቃላይ መረጃ…",
    "events.dateTime": "ቀን እና ሰዓት",
    "events.locationLabel": "የመገናኛ አድራሻ",
    "events.locationPlaceholder": "ለምሳሌ፦ እንጦጦ ፓርክ ዋና በር፣ አዲስ አበባ",
    "events.linkPlace": "ከተመዘገበ ቦታ ጋር ያገናኙ (አማራጭ)",
    "events.linkRoom": "የተዛመደ ክፍል (አማራጭ)",
    "events.coverUrlLabel": "የሽፋን ምስል ማስፈንጠሪያ",
    "events.submit": "ዝግጅቱን ይፋ አድርግ",
    "events.submitting": "በመለጠፍ ላይ…",
    "events.deleteConfirm": "ይህን ዝግጅት መሰረዝ እንደሚፈልጉ እርግጠኛ ነዎት?",

    // Categories / Rooms
    "room.coffeeTalk": "ቡና ቤት",
    "room.sportsTalk": "ስፖርት",
    "room.whatsNew": "አዲስ ዜና",
    "room.ethiopianCinema": "የኢትዮጵያ ፊልም",
    "room.bookReviews": "የመጽሐፍ ግምገማ",
    "room.hikingExperiences": "የእግር ጉዞ",
    "room.music": "ሙዚቃ",
    "room.physicalExercise": "የአካል እንቅስቃሴ",
    "room.painting": "ሥዕል",
    "room.travel": "ጉዞ",
    "room.lifeStories": "የሕይወት ተሞክሮ",

    // Place Kinds
    "kind.cinema": "ሲኒማ",
    "kind.theatre": "ቲያትር",
    "kind.hotel": "ሆቴል",
    "kind.hiking": "የእግር ጉዞ",
    "kind.cafe": "ካፌ",
    "kind.restaurant": "ምግብ ቤት",
    "kind.gym": "ጂም",
    "kind.stadium": "ስታዲየም",
    "kind.gallery": "ጋለሪ",
    "kind.library": "ቤተ መጻሕፍት",
    "kind.hospital": "ሆስፒታል",
    "kind.pharmacy": "ፋርማሲ",
    "kind.gas_station": "የነዳጅ ማደያ",
    "kind.school": "ትምህርት ቤት",

    // Common / UI
    "common.theme": "ገጽታ",
    "common.light": "ብርሃን",
    "common.dark": "ጨለማ",
    "common.system": "የስርዓት",
    "common.switchTheme": "ገጽታ",
    "common.language": "ቋንቋ",
    "common.selectLanguage": "ቋንቋ ይምረጡ",
    "common.hotInHub": "የዕለቱ ሞቃት",
    "common.coffeeToast": "ጥሩ ውይይት በቡና ስኒና በታሪክ ይጀምራል። አብረውን ይሁኑ።",
    "common.bunaTetu": "ቡና ተጠጡ",
    "common.joinCommunity": "ስለ ፊልሞች፣ መጻሕፍት፣ ጉዞዎች እና የዕለት ተዕለት ሕይወት የሚያወራውን ማህበረሰብ ይቀላቀሉ።",
  },

  om: {
    // Navigation
    "nav.home": "Fuula Duraa",
    "nav.explore": "Sakatta'i",
    "nav.categories": "Kutaalee",
    "nav.places": "Bakkeewwan Dhiyoo",
    "nav.events": "Qophiiwwan",
    "nav.meetups": "Walgahii",
    "nav.sports": "Ispoortii",
    "nav.cinema": "Siinimaa",
    "nav.theatre": "Tiyaatirii",
    "nav.quiz": "Itoophiyaa Haabarru",
    "nav.jokes": "Yeroo Qoosaa",
    "nav.messages": "Ergaawwan",
    "nav.notifications": "Beeksisa",
    "nav.bookmarks": "Kan Olkaa'aman",
    "nav.profile": "Profaayilii",
    "nav.settings": "Qindaa'ina",
    "nav.admin": "Daashboordii Bulchiinsaa",
    "nav.signIn": "Seeni",
    "nav.join": "Miseensa Ta'i",
    "nav.signOut": "Ba'i",
    "nav.post": "Maxxansi",
    "nav.search": "Barbaadi",
    "nav.searchPlaceholder": "Fiilmii, kitaaba, imala, namoota barbaadi…",

    // Nearby / Places page
    "places.badge": "Dhiyoo",
    "places.title": "Bakkeewwan manaa ba'anii daawwatamuu qaban.",
    "places.subtitle": "Sinimaa, tiyaatira, hoteelota, jimmota, gaaleeriifi buna mi'aawaa — akkasumas hospitaalota, faramaasii, buufata boba'aa, mana barumsaa, mana fincaanii uummataa, bakka konkolaataa dhaabuu, bakka baatirii elektrifikii, bakka konkolaataa uummataa, baankii fi ATM — dhiyeenya keessan irratti hundaa'ee qophaa'e.",
    "places.everything": "Hundumaa",
    "places.saved": "Kan Olkaa'aman",
    "places.liveOpenMap": "Kaartaa Kallattii",
    "places.syncOpenMap": "Kaartaa Haaromsi",
    "places.syncing": "Haaromsamaa jira…",
    "places.searchPlaceholder": "Bakkeewwan barbaadi…",
    "places.allCities": "Magaalota hunda",
    "places.sortTopRated": "Sadarkaa Olaanaa",
    "places.sortNearest": "Baay'ee Dhiyoo",
    "places.sortName": "A – Z",
    "places.nearMe": "Dhiyoo koo",
    "places.pickArea": "Naannoo filadhu",
    "places.approx": "tilmaama",
    "places.close": "Cufi",
    "places.chooseArea": "Naannoo jiraattus filadhu…",
    "places.areaHelp": "GPS yoo hin jiraanne, naannoo jiraattus filadhu — fageenyi giddugala naannoo sanaa irraa shallagama.",
    "places.insecureLocation": "Bilbilli GPS HTTPS irratti qofa qooda. Naannoo filadhu, fageenyaan ni qindeessina.",
    "places.useMyLocation": "Iddoo koo fayyadami",
    "places.findingYou": "Bakka kee barbaadaa jira…",
    "places.clearFilters": "Filtara haqi",
    "places.match": "bakki argameera",
    "places.matches": "bakkeewwan argamaniiru",
    "places.sortedFromYou": "bakka jirtan irraa dhiyeenyaan tartiibeffame",
    "places.emptyTitle": "Wanti argame hin jiru",
    "places.emptyDesc": "Bakki barbaaddan hin argamne. Mee irra deebi'aa barbaadaa yookiin filtara haqaati yaalaa.",
    "places.browseAll": "Bakkeewwan hunda ilaali",
    "places.liveOsmSyncEnabled": "Walsimsiisa OpenStreetMap kallattii banaadha",
    "places.directions": "Kallattii Agarsiisi",
    "places.seePlace": "Bakka sana daawwadhu",
    "places.communityList": "Tarree Hawaasaa",
    "places.disclaimer": "Mallattoon bakkeewwanii naannoo qofa agarsiisa. Osoo hin deemne sa'aatii hojii mirkaneeffadhaa.",

    // Events & Meetups
    "events.badge": "Walga'ii fi Qophii",
    "events.title": "Walga'ii qabatamaa, halkan sinimaa fi imala gaaraa.",
    "events.subtitle": "Iskiriinii bira darbaa wal argaa. Qophiiwwan hawaasaa, imala gaaraa fi sirna bunaa irratti hirmaadhaa.",
    "events.create": "Qophii Qopheessi",
    "events.upcoming": "Qophiiwwan Dhufan",
    "events.all": "Qophii Hunda",
    "events.searchPlaceholder": "Qophii mata-duree, bakka yookiin qopheessaan barbaadi…",
    "events.going": "Nan Dhaqa",
    "events.interested": "Fedhii Qaba",
    "events.attendees": "hirmaattota",
    "events.host": "Kan Qopheesse",
    "events.venue": "Bakka",
    "events.room": "Kutaa",
    "events.maxAttendees": "hanga daangaa",
    "events.emptyTitle": "Qophiin argame hin jiru",
    "events.emptyDesc": "Qophii bunaa yookiin imala gaaraa qopheessuuf nama jalqabaa ta'aa!",
    "events.modalTitle": "Qophii Hawaasaa Haaraa Qopheessi",
    "events.titleLabel": "Mata-duree Qophii",
    "events.titlePlaceholder": "fakkeenyaaf: Imala Dirree Intxoxxoo Dilbata Ganamaa",
    "events.descLabel": "Ibsa",
    "events.descPlaceholder": "Bakka wal-argaa, wantoota barbaachisanii fi odeeffannoo waliigalaa…",
    "events.dateTime": "Guyyaa fi Sa'aatii",
    "events.locationLabel": "Teessoo Wal-argaa",
    "events.locationPlaceholder": "fakkeenyaaf: Karra Guddaa Paarkii Intxoxxoo, Finfinnee",
    "events.linkPlace": "Bakka galmaa'e waliin walqabsiisi (dirqama miti)",
    "events.linkRoom": "Kutaa walqabatu (dirqama miti)",
    "events.coverUrlLabel": "Liankii Suuraa Fuula Duraa",
    "events.submit": "Qophii Maxxansi",
    "events.submitting": "Maxxansaa jira…",
    "events.deleteConfirm": "Qophii kana haquu akka barbaaddu mirkaneeffatteettaa?",

    // Categories / Rooms
    "room.coffeeTalk": "Mana Bunaa",
    "room.sportsTalk": "Ispoortii",
    "room.whatsNew": "Oduu Haaraa",
    "room.ethiopianCinema": "Fiilmii Itoophiyaa",
    "room.bookReviews": "Gamaaggama Kitaabaa",
    "room.hikingExperiences": "Imala Gaaraa",
    "room.music": "Muuziqaa",
    "room.physicalExercise": "Sochii Qaamaa",
    "room.painting": "Fakkii / Aartii",
    "room.travel": "Imala",
    "room.lifeStories": "Muuxannoo Jireenyaa",

    // Place Kinds
    "kind.cinema": "Sinimaa",
    "kind.theatre": "Tiyaatira",
    "kind.hotel": "Hoteela",
    "kind.hiking": "Imala Gaaraa",
    "kind.cafe": "Kaaffee",
    "kind.restaurant": "Mana Nyaataa",
    "kind.gym": "Jiimii",
    "kind.stadium": "Istaadiyeemii",
    "kind.gallery": "Gaaleerii",
    "kind.library": "Mana Kitaabaa",
    "kind.hospital": "Hospitaala",
    "kind.pharmacy": "Faramaasii",
    "kind.gas_station": "Buufata Boba'aa",
    "kind.school": "Mana Barumsaa",

    // Common / UI
    "common.theme": "Haala Mul'ataa",
    "common.light": "Ifaa",
    "common.dark": "Dukkana",
    "common.system": "Sirna",
    "common.switchTheme": "haala",
    "common.language": "Afaan",
    "common.selectLanguage": "Afaan filadhu",
    "common.hotInHub": "Haasa'amaa kan jiru",
    "common.coffeeToast": "Mariin gaariin si'a bunaatiifi seenaadhaan eegala. Nu waliin ta'aa.",
    "common.bunaTetu": "Buna dhugaa",
    "common.joinCommunity": "Hawaasa waa'ee fiilmii, kitaaba, imalaafi jireenya guyyuu mari'atuutti dabalamaa.",
  },

  // Tigrinya shares the Ge'ez script with Amharic. The interface copy is kept
  // in a separate file so translators can work on it without touching code.
  ti: keyTranslationsTi as Record<string, string>,
};

/**
 * Phrase catalog, keyed by the English copy itself. Static JSX text and UI
 * attributes are wrapped in tt() at build time (frontend/i18n), so a screen
 * needs no hand-written key per sentence and user content is never touched:
 * anything rendered from the API arrives as an expression, not a literal.
 *
 * Regenerate with:
 *   node frontend/i18n/extract-phrases.cjs
 *   node frontend/i18n/translate-phrases.mjs
 */
const extra = extraPhrases as Record<Exclude<SupportedLang, "en">, Record<string, string>>;

// extra.json holds hand-written strings that never reach the extractor (ARIA
// labels, pluralised counts) and overrides a few machine translations.
const phrases: Record<Exclude<SupportedLang, "en">, Record<string, string>> = {
  am: { ...(phraseAm as Record<string, string>), ...extra.am },
  om: { ...(phraseOm as Record<string, string>), ...extra.om },
  ti: { ...(phraseTi as Record<string, string>), ...extra.ti },
};

let activeLang: SupportedLang = "en";

/** Kept in sync by the i18n store so tt() can run outside React. */
export function setActiveLang(lang: SupportedLang): void {
  activeLang = lang;
}

export function getActiveLang(): SupportedLang {
  return activeLang;
}

/** Translate one static UI phrase into the language currently selected. */
export function tt(phrase: string): string {
  if (activeLang === "en") return phrase;
  return phrases[activeLang]?.[phrase] ?? phrase;
}

export function translate(key: string, lang: SupportedLang = "en", fallback?: string): string {
  const dictionary = translations[lang] || translations.en;
  const english = translations.en[key] ?? fallback ?? key;
  if (dictionary[key]) return dictionary[key];
  if (lang === "en") return english;
  return phrases[lang][english] ?? english;
}
