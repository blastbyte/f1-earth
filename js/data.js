// 2026 FIA Formula One World Championship calendar, as originally published (24 rounds).
// Bahrain and Saudi Arabia were cancelled in March 2026 because of the conflict in the
// Middle East. They stay on the globe, marked as cancelled.
//
// Lap records are official race lap records (fastest lap set during a Grand Prix),
// as they stood going into the 2026 season.
// `wiki` is the English Wikipedia article used to fetch a photo at runtime.

export const SEASON = 2026;

export const CIRCUITS = [
  {
    id: 'au-1953', gp: 'Australian Grand Prix', name: 'Albert Park Circuit', short: 'Melbourne',
    city: 'Melbourne', country: 'Australia', flag: '🇦🇺', date: '2026-03-08',
    lengthKm: 5.278, laps: 58, turns: 14, firstGp: 1996, type: 'Street / park circuit',
    record: { time: '1:19.813', driver: 'Charles Leclerc', year: 2024 },
    wiki: 'Albert_Park_Circuit',
    blurb: 'A fast, flowing lap around Albert Park Lake, using public roads closed off for the race weekend.'
  },
  {
    id: 'cn-2004', gp: 'Chinese Grand Prix', name: 'Shanghai International Circuit', short: 'Shanghai',
    city: 'Shanghai', country: 'China', flag: '🇨🇳', date: '2026-03-15', sprint: true,
    lengthKm: 5.451, laps: 56, turns: 16, firstGp: 2004, type: 'Permanent circuit',
    record: { time: '1:32.238', driver: 'Michael Schumacher', year: 2004 },
    wiki: 'Shanghai_International_Circuit',
    blurb: 'Laid out in the shape of the Chinese character "shang", with the tightening snail of Turns 1-2 and one of the longest straights on the calendar.'
  },
  {
    id: 'jp-1962', gp: 'Japanese Grand Prix', name: 'Suzuka International Racing Course', short: 'Suzuka',
    city: 'Suzuka', country: 'Japan', flag: '🇯🇵', date: '2026-03-29',
    lengthKm: 5.807, laps: 53, turns: 18, firstGp: 1987, type: 'Permanent circuit',
    record: { time: '1:30.965', driver: 'Kimi Antonelli', year: 2025 },
    wiki: 'Suzuka_International_Racing_Course',
    blurb: 'The only figure-of-eight on the calendar: the Esses, Degner, the Hairpin, Spoon and the flat-out 130R.'
  },
  {
    id: 'bh-2002', gp: 'Bahrain Grand Prix', name: 'Bahrain International Circuit', short: 'Sakhir',
    city: 'Sakhir', country: 'Bahrain', flag: '🇧🇭', date: '2026-04-12', cancelled: true,
    lengthKm: 5.412, laps: 57, turns: 15, firstGp: 2004, type: 'Permanent circuit',
    record: { time: '1:31.447', driver: 'Pedro de la Rosa', year: 2005 },
    wiki: 'Bahrain_International_Circuit',
    blurb: 'A desert circuit in Sakhir, raced under floodlights since 2014. The 2026 race was cancelled.'
  },
  {
    id: 'sa-2021', gp: 'Saudi Arabian Grand Prix', name: 'Jeddah Corniche Circuit', short: 'Jeddah',
    city: 'Jeddah', country: 'Saudi Arabia', flag: '🇸🇦', date: '2026-04-19', cancelled: true,
    lengthKm: 6.174, laps: 50, turns: 27, firstGp: 2021, type: 'Street circuit',
    record: { time: '1:30.734', driver: 'Lewis Hamilton', year: 2021 },
    wiki: 'Jeddah_Corniche_Circuit',
    blurb: 'The fastest street circuit in F1, running along the Red Sea waterfront. The 2026 race was cancelled.'
  },
  {
    id: 'us-2022', gp: 'Miami Grand Prix', name: 'Miami International Autodrome', short: 'Miami',
    city: 'Miami Gardens', country: 'United States', flag: '🇺🇸', date: '2026-05-03', sprint: true,
    lengthKm: 5.412, laps: 57, turns: 19, firstGp: 2022, type: 'Temporary circuit',
    record: { time: '1:29.708', driver: 'Max Verstappen', year: 2023 },
    wiki: 'Miami_International_Autodrome',
    blurb: 'A temporary layout around Hard Rock Stadium, home of the Miami Dolphins.'
  },
  {
    id: 'ca-1978', gp: 'Canadian Grand Prix', name: 'Circuit Gilles Villeneuve', short: 'Montréal',
    city: 'Montréal', country: 'Canada', flag: '🇨🇦', date: '2026-05-24', sprint: true,
    lengthKm: 4.361, laps: 70, turns: 14, firstGp: 1978, type: 'Semi-permanent circuit',
    record: { time: '1:13.078', driver: 'Valtteri Bottas', year: 2019 },
    wiki: 'Circuit_Gilles_Villeneuve',
    blurb: 'On Île Notre-Dame in the St. Lawrence River, famous for the Wall of Champions at the final chicane.'
  },
  {
    id: 'mc-1929', gp: 'Monaco Grand Prix', name: 'Circuit de Monaco', short: 'Monaco',
    city: 'Monte Carlo', country: 'Monaco', flag: '🇲🇨', date: '2026-06-07',
    lengthKm: 3.337, laps: 78, turns: 19, firstGp: 1950, type: 'Street circuit',
    record: { time: '1:12.909', driver: 'Lewis Hamilton', year: 2021 },
    wiki: 'Circuit_de_Monaco',
    blurb: 'Through the streets of Monte Carlo: Sainte Dévote, Casino Square, the Fairmont hairpin, the tunnel and the harbour.'
  },
  {
    id: 'es-1991', gp: 'Barcelona-Catalunya Grand Prix', name: 'Circuit de Barcelona-Catalunya', short: 'Barcelona',
    city: 'Montmeló', country: 'Spain', flag: '🇪🇸', date: '2026-06-14',
    lengthKm: 4.657, laps: 66, turns: 14, firstGp: 1991, type: 'Permanent circuit',
    record: { time: '1:15.743', driver: 'Oscar Piastri', year: 2025 },
    wiki: 'Circuit_de_Barcelona-Catalunya',
    blurb: 'Pre-season testing favourite north of Barcelona, a complete test of an F1 car\'s aerodynamics.'
  },
  {
    id: 'at-1969', gp: 'Austrian Grand Prix', name: 'Red Bull Ring', short: 'Spielberg',
    city: 'Spielberg', country: 'Austria', flag: '🇦🇹', date: '2026-06-28',
    lengthKm: 4.318, laps: 71, turns: 10, firstGp: 1970, type: 'Permanent circuit',
    record: { time: '1:05.619', driver: 'Carlos Sainz', year: 2020 },
    wiki: 'Red_Bull_Ring',
    blurb: 'A short, steep lap in the Styrian mountains with big elevation changes and three heavy braking zones.'
  },
  {
    id: 'gb-1948', gp: 'British Grand Prix', name: 'Silverstone Circuit', short: 'Silverstone',
    city: 'Silverstone', country: 'United Kingdom', flag: '🇬🇧', date: '2026-07-05', sprint: true,
    lengthKm: 5.891, laps: 52, turns: 18, firstGp: 1950, type: 'Permanent circuit',
    record: { time: '1:27.097', driver: 'Max Verstappen', year: 2020 },
    wiki: 'Silverstone_Circuit',
    blurb: 'A former RAF airfield and host of the first ever World Championship race in 1950. Maggotts-Becketts-Chapel is a classic.'
  },
  {
    id: 'be-1925', gp: 'Belgian Grand Prix', name: 'Circuit de Spa-Francorchamps', short: 'Spa',
    city: 'Stavelot', country: 'Belgium', flag: '🇧🇪', date: '2026-07-19',
    lengthKm: 7.004, laps: 44, turns: 19, firstGp: 1950, type: 'Permanent circuit',
    record: { time: '1:44.701', driver: 'Sergio Pérez', year: 2024 },
    wiki: 'Circuit_de_Spa-Francorchamps',
    blurb: 'The longest lap on the calendar, winding through the Ardennes forest and up the hill at Eau Rouge-Raidillon.'
  },
  {
    id: 'hu-1986', gp: 'Hungarian Grand Prix', name: 'Hungaroring', short: 'Budapest',
    city: 'Mogyoród', country: 'Hungary', flag: '🇭🇺', date: '2026-07-26',
    lengthKm: 4.381, laps: 70, turns: 14, firstGp: 1986, type: 'Permanent circuit',
    record: { time: '1:16.627', driver: 'Lewis Hamilton', year: 2020 },
    wiki: 'Hungaroring',
    blurb: 'Tight and twisty, set in a valley outside Budapest. Often called "Monaco without the walls".'
  },
  {
    id: 'nl-1948', gp: 'Dutch Grand Prix', name: 'Circuit Zandvoort', short: 'Zandvoort',
    city: 'Zandvoort', country: 'Netherlands', flag: '🇳🇱', date: '2026-08-23', sprint: true,
    lengthKm: 4.259, laps: 72, turns: 14, firstGp: 1952, type: 'Permanent circuit',
    record: { time: '1:11.097', driver: 'Lewis Hamilton', year: 2021 },
    wiki: 'Circuit_Zandvoort',
    blurb: 'Through the North Sea dunes, with the steeply banked Hugenholtz and Arie Luyendyk corners. 2026 is its final F1 race.'
  },
  {
    id: 'it-1922', gp: 'Italian Grand Prix', name: 'Autodromo Nazionale Monza', short: 'Monza',
    city: 'Monza', country: 'Italy', flag: '🇮🇹', date: '2026-09-06',
    lengthKm: 5.793, laps: 53, turns: 11, firstGp: 1950, type: 'Permanent circuit',
    record: { time: '1:20.901', driver: 'Lando Norris', year: 2025 },
    wiki: 'Monza_Circuit',
    blurb: 'The Temple of Speed in the royal park of Monza, with the old banked oval still standing in the trees.'
  },
  {
    id: 'es-2026', gp: 'Spanish Grand Prix', name: 'Madring', short: 'Madrid',
    city: 'Madrid', country: 'Spain', flag: '🇪🇸', date: '2026-09-13',
    lengthKm: 5.474, laps: 57, turns: 22, firstGp: 2026, type: 'Hybrid street circuit',
    record: null,
    wiki: 'Madring',
    blurb: 'New for 2026: a street and purpose-built layout around the IFEMA exhibition centre, featuring the banked "La Monumental" corner.'
  },
  {
    id: 'az-2016', gp: 'Azerbaijan Grand Prix', name: 'Baku City Circuit', short: 'Baku',
    city: 'Baku', country: 'Azerbaijan', flag: '🇦🇿', date: '2026-09-26',
    lengthKm: 6.003, laps: 51, turns: 20, firstGp: 2016, type: 'Street circuit',
    record: { time: '1:43.009', driver: 'Charles Leclerc', year: 2019 },
    wiki: 'Baku_City_Circuit',
    blurb: 'A 2.2 km flat-out run along the Caspian seafront, then a narrow climb past the medieval walls of the Old City.'
  },
  {
    id: 'sg-2008', gp: 'Singapore Grand Prix', name: 'Marina Bay Street Circuit', short: 'Singapore',
    city: 'Singapore', country: 'Singapore', flag: '🇸🇬', date: '2026-10-11', sprint: true,
    lengthKm: 4.940, laps: 62, turns: 19, firstGp: 2008, type: 'Street circuit',
    record: { time: '1:33.808', driver: 'Lewis Hamilton', year: 2025 },
    wiki: 'Marina_Bay_Street_Circuit',
    blurb: 'F1\'s original night race, around Marina Bay with the Singapore skyline lit up behind it.'
  },
  {
    id: 'us-2012', gp: 'United States Grand Prix', name: 'Circuit of the Americas', short: 'Austin',
    city: 'Austin', country: 'United States', flag: '🇺🇸', date: '2026-10-25',
    lengthKm: 5.513, laps: 56, turns: 20, firstGp: 2012, type: 'Permanent circuit',
    record: { time: '1:36.169', driver: 'Charles Leclerc', year: 2019 },
    wiki: 'Circuit_of_the_Americas',
    blurb: 'Climbs steeply up to Turn 1, then borrows from the best: Maggotts-Becketts esses and a Hockenheim-style stadium section.'
  },
  {
    id: 'mx-1962', gp: 'Mexico City Grand Prix', name: 'Autódromo Hermanos Rodríguez', short: 'Mexico City',
    city: 'Mexico City', country: 'Mexico', flag: '🇲🇽', date: '2026-11-01',
    lengthKm: 4.304, laps: 71, turns: 17, firstGp: 1963, type: 'Permanent circuit',
    record: { time: '1:17.774', driver: 'Valtteri Bottas', year: 2021 },
    wiki: 'Autódromo_Hermanos_Rodríguez',
    blurb: 'At about 2,200 m, the thin air cuts downforce, and the lap ends with a run through the packed Foro Sol baseball stadium.'
  },
  {
    id: 'br-1940', gp: 'São Paulo Grand Prix', name: 'Autódromo José Carlos Pace (Interlagos)', short: 'Interlagos',
    city: 'São Paulo', country: 'Brazil', flag: '🇧🇷', date: '2026-11-08', sprint: true,
    lengthKm: 4.309, laps: 71, turns: 15, firstGp: 1973, type: 'Permanent circuit',
    record: { time: '1:10.540', driver: 'Valtteri Bottas', year: 2018 },
    wiki: 'Interlagos_Circuit',
    blurb: 'Raced anti-clockwise in a natural bowl between two lakes. The Senna S and the uphill run to the line are classics.'
  },
  {
    id: 'us-2023', gp: 'Las Vegas Grand Prix', name: 'Las Vegas Strip Circuit', short: 'Las Vegas',
    city: 'Las Vegas', country: 'United States', flag: '🇺🇸', date: '2026-11-21',
    lengthKm: 6.201, laps: 50, turns: 17, firstGp: 2023, type: 'Street circuit',
    record: { time: '1:34.876', driver: 'Lando Norris', year: 2024 },
    wiki: 'Las_Vegas_Strip_Circuit',
    blurb: 'A Saturday-night race past the casinos, with a 1.9 km flat-out blast down the Strip itself.'
  },
  {
    id: 'qa-2004', gp: 'Qatar Grand Prix', name: 'Lusail International Circuit', short: 'Lusail',
    city: 'Lusail', country: 'Qatar', flag: '🇶🇦', date: '2026-11-29',
    lengthKm: 5.419, laps: 57, turns: 16, firstGp: 2021, type: 'Permanent circuit',
    record: { time: '1:22.384', driver: 'Lando Norris', year: 2024 },
    wiki: 'Lusail_International_Circuit',
    blurb: 'Built for MotoGP: long, fast, flowing medium- and high-speed corners in the desert north of Doha.'
  },
  {
    id: 'ae-2009', gp: 'Abu Dhabi Grand Prix', name: 'Yas Marina Circuit', short: 'Yas Marina',
    city: 'Abu Dhabi', country: 'United Arab Emirates', flag: '🇦🇪', date: '2026-12-06',
    lengthKm: 5.281, laps: 58, turns: 16, firstGp: 2009, type: 'Permanent circuit',
    record: { time: '1:25.637', driver: 'Kevin Magnussen', year: 2024 },
    wiki: 'Yas_Marina_Circuit',
    blurb: 'The season finale starts in daylight and finishes under floodlights, passing beneath the W Abu Dhabi hotel.'
  }
];

// Assign round numbers among the races that are actually going ahead,
// and work out race status relative to today.
export function enrichCircuits(today = new Date()) {
  let round = 0;
  let nextFound = false;
  const todayStr = today.toISOString().slice(0, 10);
  for (const c of CIRCUITS) {
    c.distanceKm = +(c.lengthKm * c.laps).toFixed(3);
    if (c.cancelled) {
      c.round = null;
      c.status = 'cancelled';
      continue;
    }
    c.round = ++round;
    if (c.date < todayStr) c.status = 'completed';
    else if (!nextFound) { c.status = 'next'; nextFound = true; }
    else c.status = 'upcoming';
  }
  return CIRCUITS;
}
