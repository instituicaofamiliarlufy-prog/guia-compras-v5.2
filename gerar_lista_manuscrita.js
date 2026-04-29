import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, updateDoc, getDoc, collection } from "firebase/firestore";

// Configuração do teu Firebase (preencher com as tuas credenciais)
const firebaseConfig = {
  apiKey:            "AIzaSyCGzgFbleV3H6tZpOEW0voPke0LY9VTJs8",
  authDomain:        "guia-de-compras-2f883.firebaseapp.com",
  projectId:         "guia-de-compras-2f883",
  storageBucket:     "guia-de-compras-2f883.firebasestorage.app",
  messagingSenderId: "375038437557",
  appId:             "1:375038437557:web:f3e21dc6f40b2a04e076fc"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Dados mapeados (Manuscrito -> Canonizado -> Metadados do Histórico/Catálogo)
const itensParaImportar = [
  { original: "óleo vegetal", canon: "Óleo de Soja Fula 1L", catId: "Graos E Mercearia", preco: 2150, unit: "un" },
  { original: "açúcar", canon: "Açúcar branco Patriota 1kg", catId: "Graos E Mercearia", preco: 949, unit: "un" },
  { original: "limão", canon: "LIMAO NACIONAL KG", catId: "Frutas Legumes E Verduras", preco: 2000, unit: "kg" },
  { original: "cebola", canon: "CEBOLA NACIONAL KG", catId: "Frutas Legumes E Verduras", preco: 1100, unit: "kg" },
  { original: "coxa", canon: "Coxa de Frango Pkt 5kg", catId: "Talho E Congelados", preco: 7500, unit: "pack" },
  { original: "vinho", canon: "VINHO TINTO ALENTEJANO EA 750ML", catId: "Bebidas", preco: 4850, unit: "un" },
  { original: "linguiça", canon: "LINGUICA CHURRASCO PORKU'S 500G", catId: "Talho E Congelados", preco: 3200, unit: "un" },
  { original: "gasosa", canon: "LIMA-LIMAO LATA 7UP - 24 X 330 ML", catId: "Bebidas", preco: 479, unit: "un" },
  { original: "água pequena", canon: "Agua Bom Jesus 12x500ml", catId: "Bebidas", preco: 1699, unit: "un" },
  { original: "leite", canon: "Leite Gordo Mimosa 1L", catId: "Laticinios E Frios", preco: 850, unit: "un" },
  { original: "cerveja", canon: "CERVEJA TIGRA LATA 33CL", catId: "Bebidas", preco: 350, unit: "un" }
];

async function importarLista() {
  const catalogRef = doc(db, "config", "catalog"); // Caminho conforme a lógica do teu app.js
  const catalogSnap = await getDoc(catalogRef);
  let catalogData = catalogSnap.data() || {};

  const itensListaFinal = {};

  for (const item of itensParaImportar) {
    if (!catalogData[item.catId]) catalogData[item.catId] = { nome: item.catId, items: [] };
    
    // Verifica se já existe no catálogo para evitar duplicados
    let idx = catalogData[item.catId].items.findIndex(i => i.name === item.canon);
    
    if (idx === -1) {
      console.log(`Adicionando novo produto ao catálogo: ${item.canon}`);
      catalogData[item.catId].items.push({
        name: item.canon,
        preco: item.preco,
        unit: item.unit,
        defaultQty: 1
      });
      idx = catalogData[item.catId].items.length - 1;
    }

    // Estrutura de item da lista conforme definido no teu app.js (catId, itemIdx, qty, checked)
    const itemKey = `${item.catId}_${idx}`;
    itensListaFinal[itemKey] = {
      catId: item.catId,
      itemIdx: idx,
      qty: 1,
      checked: false
    };
  }

  // 1. Atualizar o catálogo no Firestore com novos produtos
  await setDoc(catalogRef, catalogData);

  // 2. Criar a nova lista de compras
  const listaId = `lista_${new Date().getTime()}`;
  const novaLista = {
    nome: "Lista Manuscrita - Importada",
    date: new Date().toISOString().split('T')[0],
    supermercado: "Vários",
    items: itensListaFinal
  };

  await setDoc(doc(db, "listas", listaId), novaLista);
  
  console.log(`Sucesso! Lista criada com ID: ${listaId}`);
  process.exit();
}

importarLista().catch(console.error);