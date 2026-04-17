// 1. Definição dos Supermercados (Tabela de Referência)
export const defaultSupermercados = [
  { id: "angomart",       nome: "Angomart",         cor: "#2D6A4F" },
  { id: "fresmart",       nome: "Fresmart",         cor: "#E07A5F" },
  { id: "freshmart",      nome: "Freshmart",        cor: "#C9A84C" },
  { id: "deskontao",      nome: "Deskontão",        cor: "#5B7FA6" },
  { id: "shoprite",       nome: "Shoprite",         cor: "#8E6BBF" },
  { id: "maxi",           nome: "Maxi",             cor: "#3D9970" },
  { id: "intermarket",    nome: "Intermarket",      cor: "#E8743B" },
  { id: "frescos-do-dia", nome: "Frescos do Dia",   cor: "#F4A261" },
  { id: "plantiloge",     nome: "Plantiloge",       cor: "#2A9D8F" },
  { id: "kibabo",         nome: "Kibabo",           cor: "#E76F51" },
  { id: "mercado-da-vila",nome: "Mercado da Vila",  cor: "#264653" },
  { id: "varios",         nome: "Vários",           cor: "#708090" },
];

// 2. Catálogo Refatorado com Dados Extraídos e IDs de Referência
export const defaultCatalog = {
  "Bebidas": [
    { name: "Água 5L",                    defaultQty: 1, unit: "un", bestShopId: "deskontao",  preco: 850 },
    { name: "Chá Camomila Lipton",        defaultQty: 1, unit: "cx", bestShopId: "angomart",   preco: 950 },
    { name: "Chá Cidreira Lipton",        defaultQty: 1, unit: "cx", bestShopId: "fresmart",   preco: 950 },
    { name: "Néctar Compal Ananás 1L",    defaultQty: 1, unit: "un", bestShopId: "maxi",       preco: 1100 },
    { name: "Sumo Ceres 200ml (Vários)",  defaultQty: 2, unit: "un", bestShopId: "angomart",   preco: 450 },
    { name: "Licor Amarula",              defaultQty: 1, unit: "un", bestShopId: "shoprite",   preco: 8500 }
  ],
  "Frutas Legumes E Verduras": [
    { name: "Abacate Kg",                 defaultQty: 1, unit: "kg", bestShopId: "angomart",       preco: 600 },
    { name: "Ananás Un",                  defaultQty: 1, unit: "un", bestShopId: "plantiloge",     preco: 1409.52 },
    { name: "Banana de Mesa Kg",          defaultQty: 2, unit: "kg", bestShopId: "frescos-do-dia", preco: 400 },
    { name: "Goiaba Mix Kg",              defaultQty: 1, unit: "kg", bestShopId: "fresmart",       preco: 1049 },
    { name: "Maçã Golden Importada",      defaultQty: 1, unit: "kg", bestShopId: "intermarket",    preco: 2450.74 },
    { name: "Maçã Top Red Importada",     defaultQty: 1, unit: "kg", bestShopId: "maxi",           preco: 1900 },
    { name: "Mamão Kg",                   defaultQty: 1, unit: "kg", bestShopId: "deskontao",      preco: 400 },
    { name: "Manga Nacional Kg",          defaultQty: 1, unit: "kg", bestShopId: "deskontao",      preco: 1399 },
    { name: "Melancia Kg",                defaultQty: 1, unit: "kg", bestShopId: "frescos-do-dia", preco: 1500 },
    { name: "Mirtilo 4x50g",              defaultQty: 1, unit: "pack", bestShopId: "shoprite",     preco: 2200 },
    { name: "Morango Nacional 250g",      defaultQty: 1, unit: "cx", bestShopId: "fresmart",       preco: 2389 },
    { name: "Cebola Kg",                  defaultQty: 1, unit: "kg", bestShopId: "frescos-do-dia", preco: 550 },
    { name: "Limão Nacional",             defaultQty: 1, unit: "kg", bestShopId: "frescos-do-dia", preco: 2000 },
    { name: "Uva Verde Un",               defaultQty: 1, unit: "cx", bestShopId: "plantiloge",     preco: 4000 }
  ],
  "Graos E Mercearia": [
    { name: "Cereais Corn Flakes Nacional 1kg", defaultQty: 1, unit: "un", bestShopId: "angomart",  preco: 1800 },
    { name: "Sementes Girassol Pv 200ml",       defaultQty: 1, unit: "un", bestShopId: "deskontao", preco: 650 },
    { name: "Azeite Gallo Puro 750ml",          defaultQty: 1, unit: "un", bestShopId: "angomart",  preco: 3200 },
    { name: "Farinha de Trigo Donna Maria 1kg", defaultQty: 1, unit: "un", bestShopId: "fresmart",  preco: 700 },
    { name: "Massa Espirais Milaneza",          defaultQty: 1, unit: "un", bestShopId: "fresmart",  preco: 1764 },
    { name: "Óleo de Soja Fula 1L",             defaultQty: 1, unit: "un", bestShopId: "fresmart",  preco: 1100 },
    { name: "Ketchup Heinz",                    defaultQty: 1, unit: "un", bestShopId: "maxi",      preco: 1650 }
  ],
  "Higiene E Limpeza": [
    { name: "Papel Higiénico Saluna (12 Rolos)", defaultQty: 1, unit: "un", bestShopId: "fresmart", preco: 1950 },
    { name: "Toalhitas Smartcare 80un",          defaultQty: 1, unit: "un", bestShopId: "angomart", preco: 1200 },
    { name: "Guarda-napo Linda",                 defaultQty: 1, unit: "un", bestShopId: "kibabo",   preco: 295 }
  ],
  "Laticinios E Frios": [
    { name: "Leite Gordo Mimosa 1L",             defaultQty: 6, unit: "L",  bestShopId: "fresmart",  preco: 850 },
    { name: "Leite Meio Gordo S/ Lactose PD 1L", defaultQty: 6, unit: "L",  bestShopId: "deskontao", preco: 920 },
    { name: "Iogurte Natural Deleite 1kg",       defaultQty: 1, unit: "un", bestShopId: "angomart",  preco: 1100 },
    { name: "Manteiga Mimosa c/ Sal 125g",       defaultQty: 1, unit: "un", bestShopId: "deskontao", preco: 1300 }
  ],
  "Talho E Congelados": [
    { name: "Coxa de Frango Pkt 5kg",        defaultQty: 1, unit: "pack", bestShopId: "fresmart",        preco: 7500 },
    { name: "Entrecosto de Porco Sanodia",   defaultQty: 0.564, unit: "kg", bestShopId: "fresmart",      preco: 2800 },
    { name: "Filete de Pescada Oceano 1kg",  defaultQty: 1, unit: "kg", bestShopId: "fresmart",          preco: 3500 },
    { name: "Carne Moída",                   defaultQty: 1, unit: "kg", bestShopId: "mercado-da-vila",   preco: 6490 }
  ]
};