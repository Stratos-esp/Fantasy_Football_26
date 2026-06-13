export type SeedPosition = "POR" | "DEF" | "MED" | "DEL";

export type SeedPlayer = { name: string; position: SeedPosition; value: number };

export type SeedTeam = {
  externalId: number;
  name: string;
  shortName: string;
  color: string;
  players: SeedPlayer[];
};

// Plantillas de LaLiga 2025/26. Los valores están en millones de euros y son la
// base del mercado fantasy: evolucionan con el rendimiento de cada jornada.
// Si en el futuro se conecta API-Football, la sincronización sustituye estos datos.
const P = (name: string, position: SeedPosition, value: number): SeedPlayer => ({ name, position, value });

export const laligaTeams: SeedTeam[] = [
  {
    externalId: 541, name: "Real Madrid", shortName: "RMA", color: "#f0f0f4",
    players: [
      P("Thibaut Courtois", "POR", 7.5), P("Andriy Lunin", "POR", 2.5),
      P("Trent Alexander-Arnold", "DEF", 9), P("Dean Huijsen", "DEF", 8), P("Antonio Rüdiger", "DEF", 6),
      P("Éder Militão", "DEF", 6.5), P("Álvaro Carreras", "DEF", 7),
      P("Federico Valverde", "MED", 12), P("Jude Bellingham", "MED", 17), P("Eduardo Camavinga", "MED", 9),
      P("Aurélien Tchouaméni", "MED", 9), P("Arda Güler", "MED", 10),
      P("Kylian Mbappé", "DEL", 20), P("Vinícius Júnior", "DEL", 18), P("Rodrygo", "DEL", 12),
    ],
  },
  {
    externalId: 529, name: "FC Barcelona", shortName: "BAR", color: "#a50044",
    players: [
      P("Joan García", "POR", 6), P("Wojciech Szczęsny", "POR", 3),
      P("Jules Koundé", "DEF", 8), P("Pau Cubarsí", "DEF", 9), P("Ronald Araujo", "DEF", 6),
      P("Alejandro Balde", "DEF", 7), P("Eric García", "DEF", 4),
      P("Pedri", "MED", 15), P("Gavi", "MED", 8), P("Frenkie de Jong", "MED", 8),
      P("Dani Olmo", "MED", 10), P("Fermín López", "MED", 7),
      P("Lamine Yamal", "DEL", 20), P("Raphinha", "DEL", 15), P("Robert Lewandowski", "DEL", 12),
    ],
  },
  {
    externalId: 530, name: "Atlético de Madrid", shortName: "ATM", color: "#cb3524",
    players: [
      P("Jan Oblak", "POR", 7), P("Juan Musso", "POR", 2),
      P("José María Giménez", "DEF", 5), P("Robin Le Normand", "DEF", 6), P("David Hancko", "DEF", 7),
      P("Marcos Llorente", "DEF", 7), P("Javi Galán", "DEF", 4),
      P("Koke", "MED", 4), P("Pablo Barrios", "MED", 9), P("Conor Gallagher", "MED", 7),
      P("Giuliano Simeone", "MED", 7), P("Thiago Almada", "MED", 8),
      P("Julián Álvarez", "DEL", 16), P("Antoine Griezmann", "DEL", 9), P("Alexander Sørloth", "DEL", 8),
    ],
  },
  {
    externalId: 531, name: "Athletic Club", shortName: "ATH", color: "#ee2523",
    players: [
      P("Unai Simón", "POR", 6), P("Julen Agirrezabala", "POR", 2),
      P("Dani Vivian", "DEF", 6), P("Aitor Paredes", "DEF", 5), P("Yuri Berchiche", "DEF", 4),
      P("Andoni Gorosabel", "DEF", 3), P("Aymeric Laporte", "DEF", 5),
      P("Oihan Sancet", "MED", 9), P("Iñigo Ruiz de Galarreta", "MED", 4), P("Mikel Jauregizar", "MED", 5),
      P("Mikel Vesga", "MED", 3), P("Alex Berenguer", "MED", 5),
      P("Nico Williams", "DEL", 15), P("Iñaki Williams", "DEL", 9), P("Gorka Guruzeta", "DEL", 6),
    ],
  },
  {
    externalId: 548, name: "Real Sociedad", shortName: "RSO", color: "#0b67b2",
    players: [
      P("Álex Remiro", "POR", 5), P("Unai Marrero", "POR", 1),
      P("Igor Zubeldia", "DEF", 4), P("Jon Aramburu", "DEF", 3), P("Aihen Muñoz", "DEF", 3),
      P("Jon Martín", "DEF", 4), P("Sergio Gómez", "DEF", 5),
      P("Brais Méndez", "MED", 8), P("Jon Gorrotxategi", "MED", 5), P("Beñat Turrientes", "MED", 4),
      P("Luka Sučić", "MED", 5), P("Pablo Marín", "MED", 3),
      P("Mikel Oyarzabal", "DEL", 11), P("Takefusa Kubo", "DEL", 10), P("Ander Barrenetxea", "DEL", 7),
    ],
  },
  {
    externalId: 533, name: "Villarreal CF", shortName: "VIL", color: "#ffe667",
    players: [
      P("Luiz Júnior", "POR", 5), P("Arnau Tenas", "POR", 2),
      P("Juan Foyth", "DEF", 4), P("Santiago Mouriño", "DEF", 4), P("Rafa Marín", "DEF", 4),
      P("Sergi Cardona", "DEF", 4), P("Kiko Femenía", "DEF", 3),
      P("Dani Parejo", "MED", 5), P("Pape Gueye", "MED", 5), P("Santi Comesaña", "MED", 5),
      P("Tajon Buchanan", "MED", 6), P("Nicolas Pépé", "MED", 9),
      P("Georges Mikautadze", "DEL", 10), P("Ayoze Pérez", "DEL", 9), P("Gerard Moreno", "DEL", 7),
    ],
  },
  {
    externalId: 543, name: "Real Betis", shortName: "BET", color: "#0bb363",
    players: [
      P("Álvaro Valles", "POR", 4), P("Pau López", "POR", 2),
      P("Héctor Bellerín", "DEF", 3), P("Natan", "DEF", 4), P("Marc Bartra", "DEF", 3),
      P("Junior Firpo", "DEF", 4), P("Aitor Ruibal", "DEF", 3),
      P("Isco", "MED", 9), P("Pablo Fornals", "MED", 5), P("Giovani Lo Celso", "MED", 7),
      P("Antony", "MED", 10), P("Ez Abde", "MED", 7),
      P("Cucho Hernández", "DEL", 8), P("Cédric Bakambu", "DEL", 4), P("Chimy Ávila", "DEL", 3),
    ],
  },
  {
    externalId: 536, name: "Sevilla FC", shortName: "SEV", color: "#d8332e",
    players: [
      P("Ørjan Nyland", "POR", 3), P("Odysseas Vlachodimos", "POR", 2),
      P("José Ángel Carmona", "DEF", 4), P("César Azpilicueta", "DEF", 2), P("Marcão", "DEF", 3),
      P("Adrià Pedrosa", "DEF", 3), P("Tanguy Nianzou", "DEF", 3),
      P("Nemanja Gudelj", "MED", 3), P("Lucien Agoumé", "MED", 5), P("Djibril Sow", "MED", 4),
      P("Rubén Vargas", "MED", 6), P("Chidera Ejuke", "MED", 4),
      P("Isaac Romero", "DEL", 5), P("Akor Adams", "DEL", 4), P("Alfon González", "DEL", 3),
    ],
  },
  {
    externalId: 532, name: "Valencia CF", shortName: "VAL", color: "#f4a014",
    players: [
      P("Julen Agirrezabala (cedido)", "POR", 4), P("Stole Dimitrievski", "POR", 2),
      P("Dimitri Foulquier", "DEF", 3), P("César Tárrega", "DEF", 5), P("Mouctar Diakhaby", "DEF", 4),
      P("José Gayà", "DEF", 5), P("José Copete", "DEF", 3),
      P("Pepelu", "MED", 5), P("Javi Guerra", "MED", 6), P("André Almeida", "MED", 5),
      P("Luis Rioja", "MED", 4), P("Baptiste Santamaría", "MED", 3),
      P("Hugo Duro", "DEL", 5), P("Diego López", "DEL", 6), P("Arnaut Danjuma", "DEL", 5),
    ],
  },
  {
    externalId: 547, name: "Girona FC", shortName: "GIR", color: "#cd2534",
    players: [
      P("Paulo Gazzaniga", "POR", 4), P("Vladyslav Krapyvtsov", "POR", 1),
      P("Arnau Martínez", "DEF", 4), P("David López", "DEF", 2), P("Daley Blind", "DEF", 3),
      P("Alejandro Francés", "DEF", 4), P("Àlex Moreno", "DEF", 3),
      P("Iván Martín", "MED", 4), P("Axel Witsel", "MED", 3), P("Viktor Tsygankov", "MED", 7),
      P("Bryan Gil", "MED", 6), P("Azzedine Ounahi", "MED", 5),
      P("Vladyslav Vanat", "DEL", 6), P("Cristhian Stuani", "DEL", 3), P("Portu", "DEL", 3),
    ],
  },
  {
    externalId: 727, name: "CA Osasuna", shortName: "OSA", color: "#d91a21",
    players: [
      P("Sergio Herrera", "POR", 3), P("Aitor Fernández", "POR", 2),
      P("Alejandro Catena", "DEF", 4), P("David García", "DEF", 4), P("Juan Cruz", "DEF", 3),
      P("Valentin Rosier", "DEF", 3), P("Abel Bretones", "DEF", 3),
      P("Jon Moncayola", "MED", 4), P("Lucas Torró", "MED", 3), P("Aimar Oroz", "MED", 5),
      P("Rubén García", "MED", 3), P("Moi Gómez", "MED", 3),
      P("Ante Budimir", "DEL", 7), P("Raúl García de Haro", "DEL", 3), P("Víctor Muñoz", "DEL", 4),
    ],
  },
  {
    externalId: 538, name: "RC Celta", shortName: "CEL", color: "#8ac3ee",
    players: [
      P("Iván Villar", "POR", 3), P("Vicente Guaita", "POR", 2),
      P("Carl Starfelt", "DEF", 4), P("Marcos Alonso", "DEF", 3), P("Óscar Mingueza", "DEF", 5),
      P("Mihailo Ristić", "DEF", 3), P("Javi Rodríguez", "DEF", 3),
      P("Fran Beltrán", "MED", 6), P("Ilaix Moriba", "MED", 4), P("Damián Rodríguez", "MED", 4),
      P("Hugo Sotelo", "MED", 4), P("Hugo Álvarez", "MED", 6),
      P("Iago Aspas", "DEL", 6), P("Borja Iglesias", "DEL", 6), P("Pablo Durán", "DEL", 5),
    ],
  },
  {
    externalId: 728, name: "Rayo Vallecano", shortName: "RAY", color: "#e53241",
    players: [
      P("Augusto Batalla", "POR", 4), P("Dani Cárdenas", "POR", 2),
      P("Andrei Ratiu", "DEF", 6), P("Florian Lejeune", "DEF", 4), P("Abdul Mumin", "DEF", 3),
      P("Pep Chavarría", "DEF", 3), P("Iván Balliu", "DEF", 2),
      P("Pathé Ciss", "MED", 3), P("Unai López", "MED", 3), P("Óscar Valentín", "MED", 3),
      P("Isi Palazón", "MED", 6), P("Álvaro García", "MED", 6),
      P("Sergio Camello", "DEL", 6), P("Jorge de Frutos", "DEL", 5), P("Randy Nteka", "DEL", 3),
    ],
  },
  {
    externalId: 798, name: "RCD Mallorca", shortName: "MLL", color: "#e20613",
    players: [
      P("Leo Román", "POR", 4), P("Lucas Bergström", "POR", 2),
      P("Pablo Maffeo", "DEF", 3), P("Martin Valjent", "DEF", 3), P("Antonio Raíllo", "DEF", 3),
      P("Johan Mojica", "DEF", 3), P("Toni Lato", "DEF", 2),
      P("Samú Costa", "MED", 5), P("Manu Morlanes", "MED", 3), P("Sergi Darder", "MED", 5),
      P("Takuma Asano", "MED", 4), P("Omar Mascarell", "MED", 2),
      P("Vedat Muriqi", "DEL", 7), P("Cyle Larin", "DEL", 4), P("Mateo Joseph", "DEL", 4),
    ],
  },
  {
    externalId: 542, name: "Deportivo Alavés", shortName: "ALA", color: "#0761af",
    players: [
      P("Antonio Sivera", "POR", 4), P("Jesús Owono", "POR", 2),
      P("Nahuel Tenaglia", "DEF", 3), P("Facundo Garcés", "DEF", 3), P("Jon Pacheco", "DEF", 4),
      P("Moussa Diarra", "DEF", 3), P("Víctor Parada", "DEF", 2),
      P("Antonio Blanco", "MED", 3), P("Jon Guridi", "MED", 4), P("Carles Aleñá", "MED", 4),
      P("Pablo Ibáñez", "MED", 3), P("Carlos Vicente", "MED", 4),
      P("Lucas Boyé", "DEL", 6), P("Toni Martínez", "DEL", 4), P("Carlos Martín", "DEL", 3),
    ],
  },
  {
    externalId: 540, name: "RCD Espanyol", shortName: "ESP", color: "#2475c5",
    players: [
      P("Marko Dmitrović", "POR", 3), P("Ángel Fortuño", "POR", 1),
      P("Omar El Hilali", "DEF", 3), P("Leandro Cabrera", "DEF", 3), P("Marash Kumbulla", "DEF", 3),
      P("Carlos Romero", "DEF", 4), P("Fernando Calero", "DEF", 2),
      P("Pol Lozano", "MED", 3), P("Edu Expósito", "MED", 5), P("Tyrhys Dolan", "MED", 6),
      P("Ramon Terrats", "MED", 3), P("Charles Pickel", "MED", 3),
      P("Javi Puado", "DEL", 6), P("Roberto Fernández", "DEL", 4), P("Kike García", "DEL", 4),
    ],
  },
  {
    externalId: 546, name: "Getafe CF", shortName: "GET", color: "#1352a1",
    players: [
      P("David Soria", "POR", 4), P("Jiri Letacek", "POR", 1),
      P("Djené Dakonam", "DEF", 3), P("Domingos Duarte", "DEF", 3), P("Abdel Abqar", "DEF", 3),
      P("Juan Iglesias", "DEF", 3), P("Diego Rico", "DEF", 2),
      P("Mauro Arambarri", "MED", 5), P("Luis Milla", "MED", 4), P("Adrián Liso", "MED", 4),
      P("Yvan Neyou", "MED", 3), P("Mario Martín", "MED", 3),
      P("Christantus Uche", "DEL", 6), P("Borja Mayoral", "DEL", 5), P("Peter Federico", "DEL", 3),
    ],
  },
  {
    externalId: 539, name: "Levante UD", shortName: "LEV", color: "#1d3a8f",
    players: [
      P("Mathew Ryan", "POR", 3), P("Pablo Cuñat", "POR", 2),
      P("Unai Elgezabal", "DEF", 3), P("Dela", "DEF", 3), P("Jeremy Toljan", "DEF", 2),
      P("Manu Sánchez", "DEF", 3), P("Adrián de la Fuente", "DEF", 2),
      P("Pablo Martínez", "MED", 3), P("Oriol Rey", "MED", 3), P("Jon Ander Olasagasti", "MED", 3),
      P("Carlos Álvarez", "MED", 5), P("José Luis Morales", "MED", 2),
      P("Etta Eyong", "DEL", 6), P("Iván Romero", "DEL", 4), P("Goduine Koyalipou", "DEL", 3),
    ],
  },
  {
    externalId: 797, name: "Elche CF", shortName: "ELC", color: "#0a8943",
    players: [
      P("Matías Dituro", "POR", 3), P("Alejandro Iturbe", "POR", 2),
      P("Pedro Bigas", "DEF", 2), P("David Affengruber", "DEF", 3), P("Víctor Chust", "DEF", 3),
      P("John Chetauya", "DEF", 2), P("Léo Petrot", "DEF", 3),
      P("Aleix Febas", "MED", 3), P("Marc Aguado", "MED", 3), P("Rodrigo Mendoza", "MED", 4),
      P("Grady Diangana", "MED", 3), P("Martim Neto", "MED", 3),
      P("Rafa Mir", "DEL", 5), P("André Silva", "DEL", 4), P("Álvaro Rodríguez", "DEL", 4),
    ],
  },
  {
    externalId: 718, name: "Real Oviedo", shortName: "OVI", color: "#2456a5",
    players: [
      P("Aarón Escandell", "POR", 3), P("Horatiu Moldovan", "POR", 2),
      P("David Costas", "DEF", 3), P("Dani Calvo", "DEF", 2), P("Rahim Alhassane", "DEF", 3),
      P("Lucas Ahijado", "DEF", 2), P("Nacho Vidal", "DEF", 2),
      P("Kwasi Sibo", "MED", 3), P("Santiago Colombatto", "MED", 3), P("Alberto Reina", "MED", 3),
      P("Santi Cazorla", "MED", 3), P("Ilyas Chaira", "MED", 3),
      P("Salomón Rondón", "DEL", 4), P("Haissem Hassan", "DEL", 4), P("Fede Viñas", "DEL", 4),
    ],
  },
];

export function seedPlayerExternalId(teamExternalId: number, index: number) {
  return teamExternalId * 1000 + index;
}
