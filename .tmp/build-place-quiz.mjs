/**
 * Builds backend/src/lib/place-quiz-data.ts for the "Guess the Place" daily game.
 *
 * For every curated subject it reads the English Wikipedia lead image (which
 * must live on Wikimedia Commons so it is freely licensed), the page intro as
 * the explanation, and the Commons file's author/license for attribution.
 *
 *   node .tmp/build-place-quiz.mjs
 *
 * A report of missing / rejected subjects is written to .tmp/place-quiz-report.json.
 */
import { writeFileSync } from "node:fs";

const UA = "AddisGebetaPlaceQuizBuilder/1.0 (https://github.com/abmak/communityhubaddisweg)";

const CATS = {
  churches: { label: "Churches, Monasteries & Mosques", kind: "PLACE" },
  castles: { label: "Castles & Palaces", kind: "PLACE" },
  ancient: { label: "Ancient Sites", kind: "PLACE" },
  cities: { label: "Cities & Towns", kind: "PLACE" },
  museums: { label: "Museums & Monuments", kind: "PLACE" },
  nature: { label: "Mountains, Lakes & Parks", kind: "PLACE" },
  food: { label: "Food & Drink", kind: "CULTURE" },
  crafts: { label: "Music, Dress & Crafts", kind: "CULTURE" },
  festivals: { label: "Festivals & Traditions", kind: "CULTURE" },
  fossils: { label: "Fossils & Early Humanity", kind: "CULTURE" },
};

// [wikipedia title, display answer, category key, region, optional extra description note]
const SUBJECTS = [
  // ---- Rock-hewn churches & monasteries -----------------------------------
  ["Rock-Hewn Churches, Lalibela", "Rock-Hewn Churches of Lalibela", "churches", "Amhara"],
  ["Church of Saint George, Lalibela", "Bete Giyorgis (Church of Saint George), Lalibela", "churches", "Amhara"],
  ["Bete Maryam", "Bete Maryam, Lalibela", "churches", "Amhara"],
  ["Bete Amanuel", "Bete Amanuel, Lalibela", "churches", "Amhara"],
  ["Abuna Yemata Guh", "Abuna Yemata Guh", "churches", "Tigray"],
  ["Debre Damo", "Debre Damo Monastery", "churches", "Tigray"],
  ["Debre Berhan Selassie Church", "Debre Berhan Selassie Church", "churches", "Amhara"],
  ["Church of Our Lady Mary of Zion", "Church of Our Lady Mary of Zion, Aksum", "churches", "Tigray"],
  ["Wukro Chirkos", "Wukro Chirkos", "churches", "Tigray"],
  ["Abreha and Atsbeha", "Abraha we Atsbeha", "churches", "Tigray"],
  ["Debre Libanos", "Debre Libanos Monastery", "churches", "Oromia"],
  ["Ura Kidane Mehret", "Ura Kidane Mehret, Lake Tana", "churches", "Amhara"],
  ["Tana Qirqos", "Tana Qirqos", "churches", "Amhara"],
  ["Gunda Gunde Monastery", "Gunda Gunde Monastery", "churches", "Tigray"],
  ["Qusquam", "Qusquam Monastery, Gondar", "churches", "Amhara"],
  ["Medhane Alem Cathedral, Addis Ababa", "Medhane Alem Cathedral, Addis Ababa", "churches", "Addis Ababa"],
  ["Holy Trinity Cathedral (Addis Ababa)", "Holy Trinity Cathedral, Addis Ababa", "churches", "Addis Ababa"],
  ["St. George's Cathedral, Addis Ababa", "St. George's Cathedral, Addis Ababa", "churches", "Addis Ababa"],
  ["Entoto Maryam Church", "Entoto Maryam Church", "churches", "Addis Ababa"],
  ["Debre Maryam Qorqor", "Debre Maryam Qorqor", "churches", "Tigray"],
  ["Azwa Maryam", "Azwa Maryam Monastery", "churches", "Amhara"],
  ["Bete Golgotha", "Bete Golgotha, Lalibela", "churches", "Amhara"],
  ["Washa Mikael Rock-Hewn Church", "Washa Mikael Rock Church", "churches", "Addis Ababa"],
  ["Adadi Mariam", "Adadi Mariam Rock Church", "churches", "Oromia"],
  ["Debre Tsion Monastery", "Debre Tsion Monastery", "churches", "Tigray"],
  ["Al Nejashi Mosque", "Al-Nejashi Mosque, Negash", "churches", "Tigray"],
  ["Grand Anwar Mosque", "Grand Anwar Mosque, Addis Ababa", "churches", "Addis Ababa"],
  ["Jamia Mosque, Harar", "Jamia Mosque, Harar", "churches", "Harari"],
  ["St. Paul's Church, Addis Ababa", "St. Paul's Church, Addis Ababa", "churches", "Addis Ababa"],
  ["Debre Werq", "Debre Werq Monastery", "churches", "Amhara"],
  ["Mertule Mariam", "Mertule Mariam Monastery", "churches", "Amhara"],

  // ---- Castles, palaces & royal sites -------------------------------------
  ["Fasil Ghebbi", "Fasil Ghebbi, Gondar", "castles", "Amhara"],
  ["Fasilides' Bath", "Fasilides' Bath, Gondar", "castles", "Amhara"],
  ["Menelik Palace", "Menelik Palace, Addis Ababa", "castles", "Addis Ababa"],
  ["National Palace (Ethiopia)", "National (Jubilee) Palace, Addis Ababa", "castles", "Addis Ababa"],
  ["Ankober", "Ankober", "castles", "Amhara"],
  ["Dungur", "Dungur Palace Ruins, Aksum", "castles", "Tigray"],
  ["Ta'akha Maryam", "Ta'akha Maryam, Aksum", "castles", "Tigray"],
  ["Yohannes IV Palace", "Yohannes IV Palace, Mekelle", "castles", "Tigray"],
  ["Amba Geshen", "Amba Geshen", "castles", "Amhara"],
  ["Maqdala", "Maqdala (Magdala) Fortress", "castles", "Amhara"],

  // ---- Ancient Aksum, Yeha & early sites ----------------------------------
  ["Aksum", "Aksum", "ancient", "Tigray"],
  ["Obelisk of Axum", "Obelisk of Axum", "ancient", "Tigray"],
  ["Yeha", "Yeha", "ancient", "Tigray"],
  ["Tiya (archaeological site)", "Tiya Megalithic Site", "ancient", "Central Ethiopia"],
  ["Melka Kunture", "Melka Kunture", "ancient", "Oromia"],
  ["Hadar, Ethiopia", "Hadar", "ancient", "Afar"],
  ["Dikika", "Dikika", "ancient", "Afar"],
  ["Lower Valley of the Omo", "Lower Omo Valley", "ancient", "South Ethiopia"],
  ["Lower Valley of the Awash", "Lower Awash Valley", "ancient", "Afar"],
  ["Middle Awash", "Middle Awash", "ancient", "Afar"],
  ["Konso", "Konso Cultural Landscape", "ancient", "South Ethiopia"],
  ["Sof Omar Caves", "Sof Omar Caves", "ancient", "Oromia"],

  // ---- Cities & towns ------------------------------------------------------
  ["Addis Ababa", "Addis Ababa", "cities", "Addis Ababa"],
  ["Gondar", "Gondar", "cities", "Amhara"],
  ["Lalibela", "Lalibela", "cities", "Amhara"],
  ["Harar", "Harar Jugol", "cities", "Harari"],
  ["Bahir Dar", "Bahir Dar", "cities", "Amhara"],
  ["Mekelle", "Mekelle", "cities", "Tigray"],
  ["Dire Dawa", "Dire Dawa", "cities", "Dire Dawa"],
  ["Jimma", "Jimma", "cities", "Oromia"],
  ["Jijiga", "Jijiga", "cities", "Somali"],
  ["Hawassa", "Hawassa", "cities", "Sidama"],
  ["Arba Minch", "Arba Minch", "cities", "South Ethiopia"],
  ["Adama, Ethiopia", "Adama (Nazret)", "cities", "Oromia"],
  ["Bishoftu", "Bishoftu (Debre Zeit)", "cities", "Oromia"],
  ["Shashamane", "Shashamane", "cities", "Oromia"],
  ["Ambo, Ethiopia", "Ambo", "cities", "Oromia"],
  ["Debre Markos", "Debre Markos", "cities", "Amhara"],
  ["Debre Birhan", "Debre Birhan", "cities", "Amhara"],
  ["Dessie", "Dessie", "cities", "Amhara"],
  ["Kombolcha", "Kombolcha", "cities", "Amhara"],
  ["Woldia", "Woldia", "cities", "Amhara"],
  ["Adigrat", "Adigrat", "cities", "Tigray"],
  ["Shire, Ethiopia", "Shire (Inda Selassie)", "cities", "Tigray"],
  ["Asosa", "Asosa", "cities", "Benishangul-Gumuz"],
  ["Gambela, Ethiopia", "Gambela", "cities", "Gambella"],
  ["Gode", "Gode", "cities", "Somali"],
  ["Semera", "Semera", "cities", "Afar"],
  ["Dilla, Ethiopia", "Dilla", "cities", "South Ethiopia"],
  ["Hosaena", "Hosaena", "cities", "Central Ethiopia"],
  ["Butajira", "Butajira", "cities", "Central Ethiopia"],
  ["Wolaita Sodo", "Wolaita Sodo", "cities", "South Ethiopia"],
  ["Mizan Teferi", "Mizan Teferi", "cities", "South West Ethiopia"],
  ["Bonga", "Bonga", "cities", "South West Ethiopia"],
  ["Yirgacheffe", "Yirgacheffe", "cities", "South Ethiopia"],
  ["Adwa", "Adwa", "cities", "Tigray"],
  ["Nekemte", "Nekemte", "cities", "Oromia"],
  ["Wukro", "Wukro", "cities", "Tigray"],
  ["Negash", "Negash", "cities", "Tigray"],
  ["Debre Tabor", "Debre Tabor", "cities", "Amhara"],
  ["Gore, Ethiopia", "Gore", "cities", "Oromia"],
  ["Wondo Genet", "Wondo Genet", "cities", "Sidama"],
  ["Sodere", "Sodere", "cities", "Oromia"],
  ["Woliso", "Woliso", "cities", "Oromia"],
  ["Sebeta", "Sebeta", "cities", "Oromia"],
  ["Addis Alem", "Addis Alem", "cities", "Oromia"],
  ["Asella", "Assela", "cities", "Oromia"],
  ["Goba", "Goba", "cities", "Oromia"],
  ["Robe, Bale", "Robe (Bale)", "cities", "Oromia"],
  ["Dinsho", "Dinsho", "cities", "Oromia"],
  ["Metu, Ethiopia", "Metu", "cities", "Oromia"],
  ["Bedele", "Bedele", "cities", "Oromia"],
  ["Tepi", "Tepi", "cities", "South West Ethiopia"],
  ["Agaro", "Agaro", "cities", "Oromia"],
  ["Turmi", "Turmi", "cities", "South Ethiopia"],
  ["Jinka", "Jinka", "cities", "South Ethiopia"],
  ["Kebri Dahar", "Kebri Dehar", "cities", "Somali"],
  ["Dubti", "Dubti", "cities", "Afar"],
  ["Moyale", "Moyale", "cities", "Oromia"],
  ["Negele Borana", "Negele Borana", "cities", "Oromia"],
  ["Kobo, Ethiopia", "Kobo", "cities", "Amhara"],
  ["Alamata", "Alamata", "cities", "Tigray"],
  ["Korem", "Korem", "cities", "Tigray"],
  ["Maychew", "Maychew", "cities", "Tigray"],
  ["Humera", "Humera", "cities", "Tigray"],
  ["Sheraro", "Sheraro", "cities", "Tigray"],
  ["Hawzien", "Hawzien", "cities", "Tigray"],
  ["Fiche", "Fiche", "cities", "Oromia"],
  ["Gorgora", "Gorgora", "cities", "Amhara"],
  ["Wolleka", "Wolleka", "cities", "Amhara"],
  ["Bati, Ethiopia", "Bati", "cities", "Amhara"],
  ["Mota, Ethiopia", "Mota", "cities", "Amhara"],
  ["Metehara", "Metehara", "cities", "Oromia"],
  ["Gewane", "Gewane", "cities", "Afar"],
  ["Mille, Ethiopia", "Mille", "cities", "Afar"],
  ["Chifra", "Chifra", "cities", "Afar"],
  ["Abala, Ethiopia", "Abala", "cities", "Afar"],
  ["Berhale", "Berhale", "cities", "Afar"],
  ["Wuchale", "Wuchale", "cities", "Amhara"],
  ["Hayk, Ethiopia", "Hayk", "cities", "Amhara"],
  ["Woreta", "Woreta", "cities", "Amhara"],
  ["Mekane Eyesus", "Mekane Eyesus", "cities", "Amhara"],
  ["Sekota", "Sekota", "cities", "Amhara"],
  ["Nefas Mewcha", "Nefas Mewcha", "cities", "Amhara"],
  ["Ziway", "Ziway", "cities", "Oromia"],
  ["Meki", "Meki", "cities", "Oromia"],
  ["Kibre Mengist", "Kibre Mengist", "cities", "Oromia"],
  ["Shakiso", "Shakiso", "cities", "Oromia"],
  ["Yabelo", "Yabelo", "cities", "Oromia"],
  ["Bule Hora", "Bule Hora", "cities", "Oromia"],
  ["Dembi Dolo", "Dembi Dolo", "cities", "Oromia"],
  ["Gimbi", "Gimbi", "cities", "Oromia"],
  ["Hagere Mariam", "Hagere Mariam", "cities", "South Ethiopia"],
  ["Durame", "Durame", "cities", "Central Ethiopia"],
  ["Worabe", "Worabe", "cities", "Central Ethiopia"],
  ["Areka", "Areka", "cities", "South Ethiopia"],
  ["Boditi", "Boditi", "cities", "South Ethiopia"],
  ["Sendafa", "Sendafa", "cities", "Oromia"],
  ["Sululta", "Sululta", "cities", "Oromia"],
  ["Chiro, Oromia", "Chiro", "cities", "Oromia"],
  ["Hirna", "Hirna", "cities", "Oromia"],
  ["Deder", "Deder", "cities", "Oromia"],
  ["Kulubi", "Kulubi", "cities", "Oromia"],
  ["Awash, Ethiopia", "Awash (town)", "cities", "Afar"],
  ["Arsi Negele", "Arsi Negele", "cities", "Oromia"],
  ["Alaba Kulito", "Alaba Kulito", "cities", "Central Ethiopia"],
  ["Yirgalem", "Yirgalem", "cities", "Sidama"],
  ["Aleta Wendo", "Aleta Wendo", "cities", "Sidama"],
  ["Sawla", "Sawla", "cities", "South Ethiopia"],
  ["Key Afer", "Key Afer", "cities", "South Ethiopia"],
  ["Omorate", "Omorate", "cities", "South Ethiopia"],

  // ---- Museums & monuments -------------------------------------------------
  ["National Museum of Ethiopia", "National Museum of Ethiopia", "museums", "Addis Ababa"],
  ["Ethnological Museum, Addis Ababa", "Ethnological Museum, Addis Ababa", "museums", "Addis Ababa"],
  ["Red Terror Martyrs' Memorial Museum", "Red Terror Martyrs Memorial Museum", "museums", "Addis Ababa"],
  ["Adwa Victory Memorial", "Adwa Victory Memorial", "museums", "Addis Ababa"],
  ["Tiglachin Monument", "Tiglachin (Derg) Monument", "museums", "Addis Ababa"],
  ["Meskel Square", "Meskel Square", "museums", "Addis Ababa"],
  ["Africa Hall", "Africa Hall", "museums", "Addis Ababa"],
  ["Monument to the Lion of Judah", "Lion of Judah Monument", "museums", "Addis Ababa"],
  ["Addis Ababa Museum", "Addis Ababa Museum", "museums", "Addis Ababa"],
  ["Unity Park", "Unity Park, Addis Ababa", "museums", "Addis Ababa"],
  ["Sheger Park", "Sheger Park (Friendship Park)", "museums", "Addis Ababa"],
  ["Yekatit 12 monument", "Yekatit 12 Martyrs' Monument", "museums", "Addis Ababa"],
  ["Merkato", "Merkato, Addis Ababa", "museums", "Addis Ababa"],
  ["Ethiopian National Theatre", "Ethiopian National Theatre", "museums", "Addis Ababa"],
  ["St. Mary's Church, Addis Ababa", "St. Mary's Church, Addis Ababa", "museums", "Addis Ababa"],
  ["Guenete Leul Palace", "Guenete Leul Palace", "museums", "Addis Ababa"],
  ["Ethiopian Parliament Building", "Ethiopian Parliament Building", "museums", "Addis Ababa"],
  ["Taitu Hotel", "Taitu Hotel", "museums", "Addis Ababa"],
  ["Hager Fikir Theatre", "Hager Fikir Theatre", "museums", "Addis Ababa"],
  ["Cinema Ethiopia", "Cinema Ethiopia", "museums", "Addis Ababa"],
  ["Addis Ababa City Hall", "Addis Ababa City Hall", "museums", "Addis Ababa"],
  ["National Archives and Library of Ethiopia", "National Archives and Library of Ethiopia", "museums", "Addis Ababa"],
  ["Addis Ababa Zoo", "Addis Ababa Zoo", "museums", "Addis Ababa"],
  ["Millennium Hall (Addis Ababa)", "Millennium Hall", "museums", "Addis Ababa"],
  ["Arat Kilo Monument", "Arat Kilo Monument", "museums", "Addis Ababa"],
  ["Adwa 00KM Museum", "Adwa 00KM Museum", "museums", "Addis Ababa"],
  ["Addis Ababa railway station", "Addis Ababa railway station", "museums", "Addis Ababa"],

  // ---- Mountains, lakes, parks & other landscapes ---------------------------
  ["Simien Mountains National Park", "Simien Mountains National Park", "nature", "Amhara"],
  ["Simien Mountains", "Simien Mountains", "nature", "Amhara"],
  ["Ras Dashen", "Ras Dashen", "nature", "Amhara"],
  ["Abuna Yosef", "Abuna Yosef", "nature", "Amhara"],
  ["Mount Batu", "Mount Batu", "nature", "Oromia"],
  ["Bale Mountains National Park", "Bale Mountains National Park", "nature", "Oromia"],
  ["Bale Mountains", "Bale Mountains", "nature", "Oromia"],
  ["Gheralta", "Gheralta Mountains", "nature", "Tigray"],
  ["Mount Entoto", "Mount Entoto", "nature", "Addis Ababa"],
  ["Danakil Depression", "Danakil Depression", "nature", "Afar"],
  ["Erta Ale", "Erta Ale Volcano", "nature", "Afar"],
  ["Afar Depression", "Afar Depression", "nature", "Afar"],
  ["Dallol, Ethiopia", "Dallol", "nature", "Afar"],
  ["Lake Tana", "Lake Tana", "nature", "Amhara"],
  ["Blue Nile Falls", "Blue Nile Falls (Tis Issat)", "nature", "Amhara"],
  ["Lake Shala", "Lake Shala", "nature", "Oromia"],
  ["Lake Abijatta", "Lake Abijatta", "nature", "Oromia"],
  ["Lake Langano", "Lake Langano", "nature", "Oromia"],
  ["Lake Ziway", "Lake Ziway (Batu)", "nature", "Oromia"],
  ["Lake Hawassa", "Lake Hawassa", "nature", "Sidama"],
  ["Lake Chamo", "Lake Chamo", "nature", "South Ethiopia"],
  ["Lake Abaya", "Lake Abaya", "nature", "South Ethiopia"],
  ["Lake Chew Bahir", "Lake Chew Bahir", "nature", "South Ethiopia"],
  ["Lake Hayq", "Lake Hayq", "nature", "Amhara"],
  ["Lake Hashenge", "Lake Hashenge", "nature", "Tigray"],
  ["Wonchi", "Wonchi Crater Lake", "nature", "Oromia"],
  ["Blue Nile", "Blue Nile (Abay) River", "nature", "Amhara"],
  ["Awash River", "Awash River", "nature", "Afar"],
  ["Omo River", "Omo River", "nature", "South Ethiopia"],
  ["Tekeze River", "Tekeze River", "nature", "Tigray"],
  ["Baro River", "Baro River", "nature", "Gambella"],
  ["Shebelle River", "Shebelle River", "nature", "Somali"],
  ["Gibe River", "Gibe River", "nature", "Oromia"],
  ["Ethiopian Highlands", "Ethiopian Highlands", "nature", "Ethiopia"],
  ["Zuqualla", "Mount Zuqualla", "nature", "Oromia"],
  ["Mount Choqa", "Choke Mountains (Mount Choqa)", "nature", "Amhara"],
  ["Awash National Park", "Awash National Park", "nature", "Afar"],
  ["Nechisar National Park", "Nechisar National Park", "nature", "South Ethiopia"],
  ["Mago National Park", "Mago National Park", "nature", "South Ethiopia"],
  ["Omo National Park", "Omo National Park", "nature", "South Ethiopia"],
  ["Gambella National Park", "Gambella National Park", "nature", "Gambella"],
  ["Yangudi Rassa National Park", "Yangudi Rassa National Park", "nature", "Afar"],
  ["Abijatta-Shalla National Park", "Abijatta-Shalla Lakes National Park", "nature", "Oromia"],
  ["Yabelo Wildlife Sanctuary", "Yabelo Wildlife Sanctuary", "nature", "Oromia"],
  ["Maze National Park", "Maze National Park", "nature", "South Ethiopia"],
  ["Borena Sayint National Park", "Borena Sayint National Park", "nature", "Amhara"],
  ["Blue Nile Gorge", "Blue Nile Gorge", "nature", "Oromia"],
  ["Kafta Sheraro National Park", "Kafta Sheraro National Park", "nature", "Tigray"],
  ["Dhati Welel National Park", "Dhati Welel National Park", "nature", "Oromia"],
  ["Guassa Community Conservation Area", "Guassa Community Conservation Area", "nature", "Amhara"],
  ["Menagesha", "Menagesha Suba Forest", "nature", "Oromia"],
  ["Koka Reservoir", "Koka Reservoir", "nature", "Oromia"],
  ["Lake Arenguade", "Lake Arenguade", "nature", "Oromia"],
  ["Lake Basaka", "Lake Beseka (Basaka)", "nature", "Oromia"],
  ["Tis Abay", "Tis Abay", "nature", "Amhara"],
  ["Gish Abay", "Gish Abay (Blue Nile source)", "nature", "Amhara"],
  ["Gilgel Abay", "Gilgel Abay River", "nature", "Amhara"],
  ["Mount Welel", "Mount Welel", "nature", "Oromia"],
  ["Mount Tullu Dimtu", "Tullu Dimtu", "nature", "Oromia"],
  ["Mount Abuye Meda", "Mount Abuye Meda", "nature", "Oromia"],
  ["Entoto Natural Park", "Entoto Natural Park", "nature", "Addis Ababa"],
  ["Chebera Churchura National Park", "Chebera Churchura National Park", "nature", "South Ethiopia"],
  ["Alatish National Park", "Alatish National Park", "nature", "Benishangul-Gumuz"],
  ["Didessa River", "Didessa River", "nature", "Oromia"],
  ["Angereb River", "Angereb River", "nature", "Amhara"],
  ["Muger River", "Muger River", "nature", "Oromia"],
  ["Mount Guna", "Mount Guna", "nature", "Amhara"],

  // ---- Food & drink --------------------------------------------------------
  ["Ethiopian cuisine", "Ethiopian cuisine", "food", "Ethiopia"],
  ["Injera", "Injera", "food", "Ethiopia"],
  ["Doro wat", "Doro wat", "food", "Ethiopia"],
  ["Kitfo", "Kitfo", "food", "Ethiopia"],
  ["Tibs", "Tibs", "food", "Ethiopia"],
  ["Shiro (food)", "Shiro", "food", "Ethiopia"],
  ["Tej", "Tej (honey wine)", "food", "Ethiopia"],
  ["Tella", "Tella", "food", "Ethiopia"],
  ["Berbere", "Berbere", "food", "Ethiopia"],
  ["Niter kibbeh", "Niter kibbeh", "food", "Ethiopia"],
  ["Mitmita", "Mitmita", "food", "Ethiopia"],
  ["Jebena", "Jebena", "food", "Ethiopia"],
  ["Coffee ceremony of Ethiopia and Eritrea", "Ethiopian coffee ceremony", "food", "Ethiopia"],
  ["Coffee production in Ethiopia", "Ethiopian coffee farming", "food", "Ethiopia"],
  ["Dabo kolo", "Kolo (dabo kolo)", "food", "Ethiopia"],
  ["Ayib", "Ayib (fresh cheese)", "food", "Ethiopia"],
  ["Gomen (food)", "Gomen", "food", "Ethiopia"],
  ["Kocho", "Kocho", "food", "South Ethiopia"],
  ["Ensete", "Enset (false banana)", "food", "South Ethiopia"],
  ["Ethiopian wine", "Ethiopian wine", "food", "Ethiopia"],
  ["Tihlo", "Tihlo", "food", "Tigray"],
  ["Himbasha", "Himbasha", "food", "Ethiopia"],
  ["Sambusa", "Sambusa", "food", "Ethiopia"],
  ["Fit-fit", "Chechebsa", "food", "Ethiopia"],
  ["Firfir", "Firfir", "food", "Ethiopia"],
  ["Gored gored", "Gored gored", "food", "Ethiopia"],
  ["Gomen wat", "Gomen wat", "food", "Ethiopia"],
  ["Bulla (food)", "Bulla", "food", "South Ethiopia"],
  ["Ambasha", "Ambasha (bread)", "food", "Tigray"],
  ["Misir wat", "Misir wat", "food", "Ethiopia"],
  ["Alicha", "Alicha", "food", "Ethiopia"],
  ["Aframomum corrorima", "Korerima (Ethiopian cardamom)", "food", "Ethiopia"],

  // ---- Music, dress & crafts ----------------------------------------------
  ["Masenqo", "Masenqo", "crafts", "Ethiopia"],
  ["Krar", "Krar", "crafts", "Ethiopia"],
  ["Begena", "Begena", "crafts", "Ethiopia"],
  ["Washint", "Washint", "crafts", "Ethiopia"],
  ["Kebero", "Kebero", "crafts", "Ethiopia"],
  ["Mesob", "Mesob", "crafts", "Ethiopia"],
  ["Habesha kemis", "Habesha kemis", "crafts", "Ethiopia"],
  ["Netela", "Netela", "crafts", "Ethiopia"],
  ["Gabi (clothing)", "Gabi", "crafts", "Ethiopia"],
  ["Shamma (clothing)", "Shamma", "crafts", "Ethiopia"],
  ["Ge'ez script", "Ge'ez script", "crafts", "Ethiopia"],
  ["Garima Gospels", "Garima Gospels", "crafts", "Tigray"],
  ["Kebra Nagast", "Kebra Nagast", "crafts", "Ethiopia"],
  ["Ethiopian art", "Ethiopian Orthodox icon painting", "crafts", "Ethiopia"],
  ["Ethiopian cross", "Ethiopian processional cross", "crafts", "Ethiopia"],
  ["Music of Ethiopia", "Ethiopian traditional music", "crafts", "Ethiopia"],
  ["Eskista", "Eskista", "crafts", "Ethiopia"],
  ["Tibeb", "Tibeb", "crafts", "Ethiopia"],
  ["Ethiopian manuscript collections", "Ethiopian illuminated manuscript", "crafts", "Ethiopia"],
  ["Ezana Stone", "Ezana Stone", "crafts", "Tigray"],
  ["Aksumite currency", "Aksumite coins", "crafts", "Tigray"],
  ["Tabot", "Tabot", "crafts", "Ethiopia"],
  ["Azmari", "Azmari minstrel tradition", "crafts", "Ethiopia"],
  ["Debtera", "Debtera", "crafts", "Ethiopia"],
  ["Ethio-jazz", "Ethio-jazz", "crafts", "Addis Ababa"],
  ["Berele", "Berele (tej flask)", "crafts", "Ethiopia"],
  ["Mitad", "Mitad (clay griddle)", "crafts", "Ethiopia"],
  ["Atamo", "Atamo drum", "crafts", "Ethiopia"],
  ["Lalibela Cross", "Lalibela Cross", "crafts", "Amhara"],
  ["Negarit", "Negarit drum", "crafts", "Ethiopia"],

  // ---- Festivals & living traditions --------------------------------------
  ["Timkat", "Timkat", "festivals", "Ethiopia"],
  ["Meskel", "Meskel", "festivals", "Ethiopia"],
  ["Enkutatash", "Enkutatash", "festivals", "Ethiopia"],
  ["Irreecha", "Irreecha", "festivals", "Oromia"],
  ["Ashenda", "Ashenda", "festivals", "Tigray"],
  ["Fasika", "Fasika (Ethiopian Easter)", "festivals", "Ethiopia"],
  ["Fichee-Chambalaalla", "Fichee-Chambalaalla", "festivals", "Sidama"],
  ["Gadaa", "Gadaa system", "festivals", "Oromia"],
  ["Ganna (festival)", "Ganna (Ethiopian Christmas)", "festivals", "Ethiopia"],
  ["Ethiopian calendar", "Ethiopian calendar", "festivals", "Ethiopia"],
  ["Kulubi", "Kulubi pilgrimage", "festivals", "Oromia"],
  ["Hidar Tsion", "Hidar Tsion festival", "festivals", "Tigray"],
  ["Adey Abeba", "Adey Abeba flower", "festivals", "Ethiopia"],
  ["Buhe", "Buhe", "festivals", "Ethiopia"],
  ["Siklet", "Siklet", "festivals", "Ethiopia"],
  ["Zema", "Zema (Ethiopian chant)", "festivals", "Ethiopia"],

  // ---- Alternate titles for subjects whose first choice lacked a free image --
  ["Fasilides' Baths", "Fasilides' Bath, Gondar", "castles", "Amhara"],
  ["Washa Mikael Church", "Washa Mikael Rock Church", "churches", "Addis Ababa"],
  ["Lion of Judah (monument)", "Lion of Judah Monument", "museums", "Addis Ababa"],
  ["Unity Park (Ethiopia)", "Unity Park, Addis Ababa", "museums", "Addis Ababa"],
  ["Friendship Park (Ethiopia)", "Friendship Park, Addis Ababa", "museums", "Addis Ababa"],
  ["Red Terror (Ethiopia)", "Red Terror Martyrs Memorial Museum", "museums", "Addis Ababa"],
  ["Adwa Victory Memorial Museum", "Adwa Victory Memorial", "museums", "Addis Ababa"],
  ["Mount Zuqualla", "Mount Zuqualla", "nature", "Oromia"],
  ["Choke Mountain", "Choke Mountains", "nature", "Amhara"],
  ["Gheralta Mountains", "Gheralta Mountains", "nature", "Tigray"],
  ["Shamma (garment)", "Shamma", "crafts", "Ethiopia"],
  ["Kolo (food)", "Kolo", "food", "Ethiopia"],
  ["Gomen (food)", "Gomen", "food", "Ethiopia"],

  // ---- Fossils & early humanity -------------------------------------------
  ["Lucy (Australopithecus)", "Lucy (Dinkinesh) fossil", "fossils", "Afar"],
  ["Selam (Australopithecus)", "Selam fossil", "fossils", "Afar"],
  ["Ardipithecus", "Ardi (Ardipithecus)", "fossils", "Afar"],
  ["Homo sapiens idaltu", "Herto Man (Homo sapiens idaltu)", "fossils", "Afar"],
  ["Omo remains", "Omo Kibish remains", "fossils", "South Ethiopia"],
  ["Australopithecus anamensis", "Australopithecus anamensis", "fossils", "Afar"],
  ["Bouri Formation", "Bouri Formation", "fossils", "Afar"],
  ["Dikika Research Project", "Dikika Research Project", "fossils", "Afar"],
];

const PROMPTS = {
  churches: "Which historic church or monastery in Ethiopia is shown in this photo?",
  castles: "Which Ethiopian castle, palace or royal site is shown in this photo?",
  ancient: "Which ancient Ethiopian site is shown in this photo?",
  cities: "Which Ethiopian city or town is shown in this photo?",
  museums: "Which Ethiopian museum or monument is shown in this photo?",
  nature: "Which Ethiopian landscape, lake or national park is shown in this photo?",
  food: "Which Ethiopian food or drink is shown in this photo?",
  crafts: "Which Ethiopian cultural treasure is shown in this photo?",
  festivals: "Which Ethiopian festival or tradition is shown in this photo?",
  fossils: "Which Ethiopian heritage discovery is shown in this photo?",
};

const BAD_FILE = /(map|locator|coat[ _]of[ _]arms|flag|logo|diagram|seal|banner|chart|icon|plan)[ _.-]/i;

function batches(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function api(host, params) {
  const url = new URL(`https://${host}/w/api.php`);
  url.search = new URLSearchParams({ format: "json", formatversion: "2", ...params }).toString();
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      lastError = err;
      await new Promise((resolve) => setTimeout(resolve, 750 * attempt));
    }
  }
  throw lastError;
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 70);
}

function firstSentences(text, max = 320) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const parts = clean.match(/[^.!?]+[.!?]+/g) || [clean];
  let out = "";
  for (const part of parts) {
    if (out && (out + part).length > max) break;
    out += part;
    if (out.length > 160) break;
  }
  return (out || clean).trim().slice(0, max);
}

function fileFromThumb(url) {
  try {
    const path = decodeURIComponent(new URL(url).pathname);
    const markers = ["/commons/thumb/", "/commons/"];
    for (const marker of markers) {
      const idx = path.indexOf(marker);
      if (idx === -1) continue;
      const rest = path.slice(idx + marker.length);
      if (marker.endsWith("thumb/")) {
        const parts = rest.split("/");
        return parts.slice(2, 3).join("/"); // a/aa/File.jpg -> File.jpg
      }
      const parts = rest.split("/");
      return parts.slice(2).join("/");
    }
    return null;
  } catch {
    return null;
  }
}

function cleanUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

async function main() {
  const subjects = SUBJECTS.map(([title, answer, catKey, region]) => ({
    title,
    answer,
    catKey,
    region,
    kind: CATS[catKey].kind,
    category: CATS[catKey].label,
    prompt: PROMPTS[catKey],
  }));

  const pagesByResolved = new Map();
  const resolvedTitle = new Map(); // requested title -> final title
  const missing = [];

  for (const batch of batches(subjects.map((s) => s.title), 20)) {
    const data = await api("en.wikipedia.org", {
      action: "query",
      redirects: "1",
      prop: "pageimages|extracts",
      piprop: "thumbnail",
      pithumbsize: "1000",
      exintro: "1",
      explaintext: "1",
      exlimit: "max",
      titles: batch.join("|"),
    });
    const query = data.query || {};
    const map = new Map();
    for (const n of query.normalized || []) map.set(n.from, n.to);
    for (const r of query.redirects || []) map.set(r.from, r.to);
    const resolve = (title) => {
      let current = title;
      for (let i = 0; i < 3; i++) {
        const next = map.get(current);
        if (!next) break;
        current = next;
      }
      return current;
    };
    for (const requested of batch) resolvedTitle.set(requested, resolve(requested));
    for (const page of query.pages || []) pagesByResolved.set(page.title, page);
  }

  const accepted = [];
  const rejected = [];

  for (const subject of subjects) {
    const page = pagesByResolved.get(resolvedTitle.get(subject.title));
    if (!page || page.missing) {
      missing.push({ answer: subject.answer, title: subject.title, reason: "missing-page" });
      continue;
    }
    const extract = firstSentences(page.extract);
    const thumb = page.thumbnail?.source;
    if (!thumb) {
      missing.push({ answer: subject.answer, title: page.title, reason: "no-lead-image", extract });
      continue;
    }
    if (!/\/wikipedia\/commons\//.test(thumb)) {
      missing.push({ answer: subject.answer, title: page.title, reason: "non-commons-image", extract });
      continue;
    }
    const file = fileFromThumb(thumb);
    if (!file || !/\.(jpe?g|png|webp)$/i.test(file) || BAD_FILE.test(file)) {
      rejected.push({ answer: subject.answer, title: page.title, file, reason: "unusable-file" });
      continue;
    }
    accepted.push({
      ...subject,
      resolvedTitle: page.title,
      pageUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
      imageUrl: cleanUrl(thumb).replace("https://thumb.wikimedia.org/", "https://upload.wikimedia.org/"),
      file,
      description: extract,
    });
  }

  // ---- Wikidata fallback: some articles have no free lead image on
  // Wikipedia, but the corresponding Wikidata item still has one (P18). -----
  const subjectByAnswer = new Map(subjects.map((s) => [s.answer, s]));
  const wikiFileByTitle = new Map();
  const pending = missing.filter((m) => m.reason !== "missing-page");

  for (const batch of batches([...new Set(pending.map((m) => m.title))], 25)) {
    const data = await api("www.wikidata.org", {
      action: "wbgetentities",
      sites: "enwiki",
      titles: batch.join("|"),
      props: "claims|sitelinks",
      languages: "en",
    });
    for (const entity of Object.values(data.entities || {})) {
      const title = entity.sitelinks?.enwiki?.title;
      const file = entity.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
      if (title && typeof file === "string") wikiFileByTitle.set(title, file);
    }
  }

  const fileInfo = new Map();
  const pendingFiles = [...new Set(wikiFileByTitle.values())].filter((f) => !BAD_FILE.test(f));
  for (const batch of batches(pendingFiles, 25)) {
    const data = await api("commons.wikimedia.org", {
      action: "query",
      prop: "imageinfo",
      iiprop: "url|extmetadata",
      iiurlwidth: "1000",
      iiextmetadatafilter: "Artist|LicenseShortName",
      titles: batch.map((f) => `File:${f}`).join("|"),
    });
    for (const page of data.query?.pages || []) {
      const info = page.imageinfo?.[0];
      if (!info?.thumburl || !/\/wikipedia\/commons\//.test(cleanUrl(info.thumburl))) continue;
      fileInfo.set(page.title.replace(/^File:/, "").replace(/_/g, " "), info);
    }
  }

  const recoveredAnswers = new Set();
  for (const item of pending) {
    const subject = subjectByAnswer.get(item.answer);
    const file = wikiFileByTitle.get(item.title);
    const info = file ? fileInfo.get(file.replace(/_/g, " ")) : null;
    if (!subject || !info || recoveredAnswers.has(item.answer)) continue;
    recoveredAnswers.add(item.answer);
    accepted.push({
      ...subject,
      resolvedTitle: item.title,
      pageUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`,
      imageUrl: cleanUrl(info.thumburl).replace("https://thumb.wikimedia.org/", "https://upload.wikimedia.org/"),
      file,
      description: item.extract || "",
      recoveredBy: "wikidata",
    });
  }

  // ---- Last resort: a Commons file named after the subject ---------------
  function normalizeName(value) {
    return value
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }
  function diceCoefficient(a, b) {
    const bigrams = (s) => {
      const out = new Set();
      for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
      return out;
    };
    const A = bigrams(a);
    const B = bigrams(b);
    if (!A.size || !B.size) return 0;
    let overlap = 0;
    for (const gram of A) if (B.has(gram)) overlap++;
    return (2 * overlap) / (A.size + B.size);
  }

  const commonsFileByAnswer = new Map();
  for (const item of missing) {
    if ([...accepted].some((a) => a.answer === item.answer)) continue;
    if (commonsFileByAnswer.has(item.answer)) continue;
    const data = await api("commons.wikimedia.org", {
      action: "query",
      list: "search",
      srsearch: item.answer,
      srnamespace: "6",
      srlimit: "8",
    });
    for (const hit of data.query?.search || []) {
      const file = hit.title.replace(/^File:/, "");
      if (BAD_FILE.test(file) || !/\.(jpe?g|png|webp)$/i.test(file)) continue;
      if (diceCoefficient(normalizeName(file), normalizeName(item.answer)) < 0.45) continue;
      commonsFileByAnswer.set(item.answer, file);
      break;
    }
  }

  const commonsInfo = new Map();
  for (const batch of batches([...new Set(commonsFileByAnswer.values())], 25)) {
    const data = await api("commons.wikimedia.org", {
      action: "query",
      prop: "imageinfo",
      iiprop: "url|extmetadata",
      iiurlwidth: "1000",
      iiextmetadatafilter: "Artist|LicenseShortName",
      titles: batch.map((f) => `File:${f}`).join("|"),
    });
    for (const page of data.query?.pages || []) {
      const info = page.imageinfo?.[0];
      if (!info?.thumburl || !/\/wikipedia\/commons\//.test(cleanUrl(info.thumburl))) continue;
      commonsInfo.set(page.title.replace(/^File:/, "").replace(/_/g, " "), info);
    }
  }

  for (const item of missing) {
    const file = commonsFileByAnswer.get(item.answer);
    const info = file ? commonsInfo.get(file.replace(/_/g, " ")) : null;
    const subject = subjectByAnswer.get(item.answer);
    if (!subject || !info || [...accepted].some((a) => a.answer === item.answer)) continue;
    const pageTitle = item.title;
    accepted.push({
      ...subject,
      resolvedTitle: pageTitle,
      pageUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, "_"))}`,
      imageUrl: cleanUrl(info.thumburl).replace("https://thumb.wikimedia.org/", "https://upload.wikimedia.org/"),
      file,
      description: item.extract || "",
      recoveredBy: "commons-search",
    });
  }

  // Fetch attribution metadata for every accepted image.
  const meta = new Map();
  for (const batch of batches([...new Set(accepted.map((a) => a.file))], 25)) {
    const data = await api("commons.wikimedia.org", {
      action: "query",
      prop: "imageinfo",
      iiprop: "url|extmetadata",
      iiextmetadatafilter: "Artist|LicenseShortName|Credit",
      titles: batch.map((f) => `File:${f}`).join("|"),
    });
    for (const page of data.query?.pages || []) {
      const info = page.imageinfo?.[0]?.extmetadata || {};
      meta.set(page.title.replace(/^File:/, "").replace(/_/g, " "), {
        artist: String(info.Artist?.value || "")
          .replace(/<[^>]+>/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 80),
        license: String(info.LicenseShortName?.value || "").trim().slice(0, 40),
      });
    }
  }

  // Subjects whose automatically matched fallback photo was off-topic.
  const DROP_ANSWERS = new Set([
    "Gode",
    "Hagere Mariam",
    "Hirna",
    "Africa Hall",
    "Maqdala (Magdala) Fortress",
    "Hadar",
    "Dikika",
    "Melka Kunture",
    "Metehara",
    "Negele Borana",
    "Debtera",
    "Dilla",
    "Gore",
    "Addis Alem",
    "Robe (Bale)",
    "Bedele",
    "Agaro",
    "Mille",
    "Maychew",
    "Arsi Negele",
    "Yirgalem",
    "Sawla",
    "National Archives and Library of Ethiopia",
    "Addis Ababa railway station",
    "Mount Batu",
    "Gomen",
    "Kocho",
    "Bulla",
    "Shamma",
    "Fasika (Ethiopian Easter)",
    "Ethiopian calendar",
    "Friendship Park, Addis Ababa",
    "Kolo",
    "Meki",
    "Washint",
    "Muger River",
    "Alicha",
    "Ankober",
    "Yirgacheffe",
    "Chechebsa",
  ]);

  const entries = [];
  const seenKeys = new Set();
  const seenAnswers = new Set();
  const seenImages = new Set();
  for (const item of accepted) {
    if (DROP_ANSWERS.has(item.answer)) continue;
    if (seenAnswers.has(item.answer)) continue;
    // Two questions must not show the same photo with different answers.
    if (seenImages.has(item.imageUrl)) continue;
    seenAnswers.add(item.answer);
    seenImages.add(item.imageUrl);
    let key = `gp-${slugify(item.answer)}`;
    let n = 2;
    while (seenKeys.has(key)) key = `gp-${slugify(item.answer)}-${n++}`;
    seenKeys.add(key);
    const info = meta.get(item.file.replace(/_/g, " ")) || {};
    entries.push({
      key,
      answer: item.answer,
      kind: item.kind,
      category: item.category,
      region: item.region,
      prompt: item.prompt,
      imageUrl: item.imageUrl,
      imageCredit: info.artist || "Wikimedia Commons contributor",
      imageLicense: info.license || "see source page",
      imagePageUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(item.file.replace(/ /g, "_"))}`,
      sourceUrl: item.pageUrl,
      description:
        item.description ||
        `${item.answer} is a well-known part of Ethiopian heritage documented on Wikimedia Commons.`,
    });
  }

  const fallbacks = accepted
    .filter((a) => a.recoveredBy)
    .map((a) => ({ answer: a.answer, file: a.file, by: a.recoveredBy }));
  const report = { accepted: entries.length, missing, rejected, fallbacks };
  writeFileSync(
    ".tmp/place-quiz-qa.json",
    JSON.stringify(
      entries.map((e) => ({ answer: e.answer, category: e.category, imageUrl: e.imageUrl })),
      null,
      2,
    ),
  );
  writeFileSync(".tmp/place-quiz-report.json", JSON.stringify(report, null, 2));

  const body = entries
    .map(
      (e) =>
        `  {\n` +
        `    key: ${JSON.stringify(e.key)},\n` +
        `    answer: ${JSON.stringify(e.answer)},\n` +
        `    kind: ${JSON.stringify(e.kind)},\n` +
        `    category: ${JSON.stringify(e.category)},\n` +
        `    region: ${JSON.stringify(e.region)},\n` +
        `    prompt: ${JSON.stringify(e.prompt)},\n` +
        `    imageUrl: ${JSON.stringify(e.imageUrl)},\n` +
        `    imageCredit: ${JSON.stringify(e.imageCredit)},\n` +
        `    imageLicense: ${JSON.stringify(e.imageLicense)},\n` +
        `    imagePageUrl: ${JSON.stringify(e.imagePageUrl)},\n` +
        `    sourceUrl: ${JSON.stringify(e.sourceUrl)},\n` +
        `    description: ${JSON.stringify(e.description)},\n` +
        `  },`,
    )
    .join("\n");

  const file = `// Generated by .tmp/build-place-quiz.mjs — do not edit by hand.\n` +
    `// Photos are freely licensed Wikimedia Commons files; each entry carries the\n` +
    `// author and license shown in the game, with a link to the source file page.\n\n` +
    `export interface PlaceQuizEntry {\n` +
    `  key: string;\n` +
    `  answer: string;\n` +
    `  kind: "PLACE" | "CULTURE";\n` +
    `  category: string;\n` +
    `  region: string;\n` +
    `  prompt: string;\n` +
    `  imageUrl: string;\n` +
    `  imageCredit: string;\n` +
    `  imageLicense: string;\n` +
    `  imagePageUrl: string;\n` +
    `  sourceUrl: string;\n` +
    `  description: string;\n` +
    `}\n\n` +
    `export const PLACE_QUIZ_ENTRIES: PlaceQuizEntry[] = [\n${body}\n];\n`;

  writeFileSync("backend/src/lib/place-quiz-data.ts", file);
  console.log(`accepted=${entries.length} missing=${missing.length} rejected=${rejected.length}`);
  for (const m of missing) console.log(`MISSING  ${m.reason.padEnd(17)} ${m.answer} (${m.title})`);
  for (const r of rejected) console.log(`REJECTED ${r.reason.padEnd(17)} ${r.answer} (${r.file})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
