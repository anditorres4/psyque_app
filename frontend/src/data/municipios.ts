export interface Municipio {
  code: string; // Código DANE 5 dígitos
  name: string;
  dept: string;
}

export const MUNICIPIOS: Municipio[] = [
  // Bogotá D.C.
  { code: "11001", name: "Bogotá D.C.", dept: "Bogotá D.C." },
  // Área metropolitana Bogotá
  { code: "25754", name: "Soacha", dept: "Cundinamarca" },
  { code: "25175", name: "Chía", dept: "Cundinamarca" },
  { code: "25099", name: "Cajicá", dept: "Cundinamarca" },
  { code: "25473", name: "Mosquera", dept: "Cundinamarca" },
  { code: "25430", name: "Madrid", dept: "Cundinamarca" },
  { code: "25290", name: "Facatativá", dept: "Cundinamarca" },
  { code: "25307", name: "Fusagasugá", dept: "Cundinamarca" },
  { code: "25758", name: "Sopó", dept: "Cundinamarca" },
  { code: "25214", name: "Cota", dept: "Cundinamarca" },
  { code: "25368", name: "La Calera", dept: "Cundinamarca" },
  { code: "25843", name: "Zipaquirá", dept: "Cundinamarca" },
  { code: "25019", name: "Anapoima", dept: "Cundinamarca" },
  { code: "25040", name: "Apulo", dept: "Cundinamarca" },
  // Antioquia
  { code: "05001", name: "Medellín", dept: "Antioquia" },
  { code: "05088", name: "Bello", dept: "Antioquia" },
  { code: "05266", name: "Envigado", dept: "Antioquia" },
  { code: "05360", name: "Itagüí", dept: "Antioquia" },
  { code: "05631", name: "Sabaneta", dept: "Antioquia" },
  { code: "05376", name: "La Estrella", dept: "Antioquia" },
  { code: "05308", name: "Girardota", dept: "Antioquia" },
  { code: "05197", name: "Copacabana", dept: "Antioquia" },
  { code: "05490", name: "Rionegro", dept: "Antioquia" },
  { code: "05440", name: "Marinilla", dept: "Antioquia" },
  { code: "05045", name: "Apartadó", dept: "Antioquia" },
  { code: "05107", name: "Caldas", dept: "Antioquia" },
  // Valle del Cauca
  { code: "76001", name: "Cali", dept: "Valle del Cauca" },
  { code: "76520", name: "Palmira", dept: "Valle del Cauca" },
  { code: "76111", name: "Buenaventura", dept: "Valle del Cauca" },
  { code: "76109", name: "Buga", dept: "Valle del Cauca" },
  { code: "76834", name: "Tuluá", dept: "Valle del Cauca" },
  { code: "76364", name: "Jamundí", dept: "Valle del Cauca" },
  { code: "76318", name: "Guadalajara de Buga", dept: "Valle del Cauca" },
  { code: "76563", name: "Pradera", dept: "Valle del Cauca" },
  { code: "76248", name: "El Cerrito", dept: "Valle del Cauca" },
  // Atlántico
  { code: "08001", name: "Barranquilla", dept: "Atlántico" },
  { code: "08758", name: "Soledad", dept: "Atlántico" },
  { code: "08433", name: "Malambo", dept: "Atlántico" },
  { code: "08296", name: "Galapa", dept: "Atlántico" },
  { code: "08638", name: "Sabanalarga", dept: "Atlántico" },
  // Bolívar
  { code: "13001", name: "Cartagena de Indias", dept: "Bolívar" },
  { code: "13430", name: "Magangué", dept: "Bolívar" },
  { code: "13490", name: "Mompox", dept: "Bolívar" },
  // Santander
  { code: "68001", name: "Bucaramanga", dept: "Santander" },
  { code: "68276", name: "Floridablanca", dept: "Santander" },
  { code: "68307", name: "Girón", dept: "Santander" },
  { code: "68615", name: "Piedecuesta", dept: "Santander" },
  { code: "68547", name: "Barrancabermeja", dept: "Santander" },
  // Risaralda
  { code: "66001", name: "Pereira", dept: "Risaralda" },
  { code: "66170", name: "Dosquebradas", dept: "Risaralda" },
  // Caldas
  { code: "17001", name: "Manizales", dept: "Caldas" },
  { code: "17042", name: "Arauca (Caldas)", dept: "Caldas" },
  // Quindío
  { code: "63001", name: "Armenia", dept: "Quindío" },
  { code: "63130", name: "Calarcá", dept: "Quindío" },
  // Tolima
  { code: "73001", name: "Ibagué", dept: "Tolima" },
  { code: "73268", name: "Espinal", dept: "Tolima" },
  { code: "73449", name: "Melgar", dept: "Tolima" },
  // Huila
  { code: "41001", name: "Neiva", dept: "Huila" },
  { code: "41298", name: "Garzón", dept: "Huila" },
  // Nariño
  { code: "52001", name: "Pasto", dept: "Nariño" },
  { code: "52356", name: "Ipiales", dept: "Nariño" },
  { code: "52835", name: "Tumaco", dept: "Nariño" },
  // Norte de Santander
  { code: "54001", name: "Cúcuta", dept: "Norte de Santander" },
  { code: "54518", name: "Pamplona", dept: "Norte de Santander" },
  { code: "54874", name: "Villa del Rosario", dept: "Norte de Santander" },
  // Meta
  { code: "50001", name: "Villavicencio", dept: "Meta" },
  { code: "50006", name: "Acacías", dept: "Meta" },
  // Boyacá
  { code: "15001", name: "Tunja", dept: "Boyacá" },
  { code: "15176", name: "Chiquinquirá", dept: "Boyacá" },
  { code: "15759", name: "Sogamoso", dept: "Boyacá" },
  // Cauca
  { code: "19001", name: "Popayán", dept: "Cauca" },
  // Córdoba
  { code: "23001", name: "Montería", dept: "Córdoba" },
  { code: "23464", name: "Lorica", dept: "Córdoba" },
  // Sucre
  { code: "70001", name: "Sincelejo", dept: "Sucre" },
  { code: "70702", name: "Sampués", dept: "Sucre" },
  // Cesar
  { code: "20001", name: "Valledupar", dept: "Cesar" },
  { code: "20045", name: "Aguachica", dept: "Cesar" },
  // Magdalena
  { code: "47001", name: "Santa Marta", dept: "Magdalena" },
  { code: "47189", name: "Ciénaga", dept: "Magdalena" },
  // La Guajira
  { code: "44001", name: "Riohacha", dept: "La Guajira" },
  { code: "44430", name: "Maicao", dept: "La Guajira" },
  // Chocó
  { code: "27001", name: "Quibdó", dept: "Chocó" },
  // Caquetá
  { code: "18001", name: "Florencia", dept: "Caquetá" },
  // Casanare
  { code: "85001", name: "Yopal", dept: "Casanare" },
  // Amazonas
  { code: "91001", name: "Leticia", dept: "Amazonas" },
  // Arauca
  { code: "81001", name: "Arauca", dept: "Arauca" },
  // Vichada
  { code: "99001", name: "Puerto Carreño", dept: "Vichada" },
  // Guainía
  { code: "94001", name: "Inírida", dept: "Guainía" },
  // Guaviare
  { code: "95001", name: "San José del Guaviare", dept: "Guaviare" },
  // Vaupés
  { code: "97001", name: "Mitú", dept: "Vaupés" },
  // Putumayo
  { code: "86001", name: "Mocoa", dept: "Putumayo" },
  // San Andrés y Providencia
  { code: "88001", name: "San Andrés", dept: "Archipiélago de San Andrés" },
];
