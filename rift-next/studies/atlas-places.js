// Positions use the same 0–1000 campus coordinates as campus-layout.json.
// Descriptions are paraphrased from https://usv.ro/resurse/harta-interactiva-usv/.
export const atlasPlaces = [
  { id: 'restaurant', building: 'RESTAURANT', point: [344, 568], type: 'SERVICII',
    title: 'Restaurantul universitar', description: 'Restaurantul campusului, modernizat pentru servirea mesei studenților.' },
  { id: 'aula', building: 'AULA', point: [785, 677], type: 'SPAȚIU UNIVERSITAR',
    title: 'Aula Magna', description: 'Aula universității, lângă corpul A.' },
  { id: 'observator', building: 'OBSERVATOR', point: [879, 386], type: 'ȘTIINȚĂ',
    title: 'Observatorul Astronomic', description: 'Observatorul Astronomic al Universității „Ștefan cel Mare” din Suceava.' },
  { id: 'biblioteca', building: 'E', point: [539, 746], type: 'STUDIU',
    title: 'Biblioteca USV', description: 'Biblioteca universitară se află în corpul E și oferă săli de lectură.' },
  { id: 'sala-sport', building: 'SPORT', point: [645, 394], type: 'SPORT',
    title: 'Sala de sport', description: 'Sală de sport modernizată, în zona centrală a campusului.' },
  { id: 'camin-2', building: 'CĂMIN 2', point: [456, 466], type: 'CAZARE',
    title: 'Căminul studențesc nr. 2', description: 'Cămin studențesc pe Strada Universității nr. 13.' },
  { id: 'teren-sport', point: [221, 352], type: 'SPORT',
    title: 'Terenul de sport', description: 'Teren cu gazon sintetic, balon presostatic și sistem de iluminat.' },
  { id: 'natatie', building: 'NATAȚIE', point: [621, 101], type: 'SPORT',
    title: 'Complexul de natație', description: 'Complex cu bazin de înot, vestiare și spații pentru pregătire fizică și kinetoterapie.' },
  { id: 'camin-4', building: 'CĂMIN 4', point: [111, 370], type: 'CAZARE',
    title: 'Căminul studențesc nr. 4', description: 'Cămin studențesc pe Strada Scurtă nr. 6.' },
];

export const atlasPlaceByBuilding = new Map(atlasPlaces.filter(place => place.building)
  .map(place => [place.building, place]));

export const atlasSourceUrl = 'https://usv.ro/resurse/harta-interactiva-usv/';
