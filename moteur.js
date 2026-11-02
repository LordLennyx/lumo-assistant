// Moteur de l'assistant Lumo : normalisation française, BM25, intentions, parcours guidés.
// Tourne entièrement dans le navigateur. La génération peut être confiée à un LLM (API) en remplaçant repondre().

const STOP = new Set("a ai alors au aux avec c ca ce ces cet cette comment d dans de des du elle en est et etc il ils j je l la le les leur lui m ma mais me mes moi mon n ne nos notre nous on ou par pas pour qu que quel quelle quels qui s sa se ses si son sur t ta te tes toi ton tu un une vos votre vous y suis peux puis faire fait veux voudrais aimerais bonjour svp stp merci est-ce quoi mon ma mes avoir".split(" "));
const SYN = {
  internet: "connexion", reseau: "connexion", co: "connexion", wifi: "wifi", "wi-fi": "wifi", box: "box", routeur: "box", modem: "box",
  lent: "lent", lente: "lent", lenteur: "lent", rame: "lent", ralenti: "lent", debit: "debit", vitesse: "debit",
  payer: "paiement", paye: "paiement", regler: "paiement", reglement: "paiement", facture: "facture", factures: "facture",
  prix: "tarif", cout: "tarif", coute: "tarif", combien: "tarif", tarifs: "tarif", offre: "offre", forfait: "offre", abonnement: "offre",
  demenage: "demenagement", demenager: "demenagement", resilier: "resiliation", arreter: "resiliation", annuler: "resiliation",
  installe: "installation", installer: "installation", raccordement: "installation", technicien: "installation",
  momo: "mobilemoney", om: "mobilemoney", orange: "mobilemoney", mtn: "mobilemoney", mobile: "mobilemoney", money: "mobilemoney",
  mdp: "motdepasse", password: "motdepasse", code: "motdepasse", panne: "panne", coupure: "panne", coupe: "panne", marche: "fonctionne"
};

function normaliser(txt) {
  return txt.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, " ").replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/).filter(t => t && !STOP.has(t)).map(t => {
      if (SYN[t]) return SYN[t];
      let r = t.replace(/(ements?|ations?|issements?)$/, "").replace(/(eaux|aux)$/, "al").replace(/([^s])s$/, "$1").replace(/(er|ez|ee|es)$/, "");
      return SYN[r] || (r.length > 2 ? r : t);
    });
}

class Index {
  constructor(docs) { this.charger(docs); }
  charger(docs) {
    this.docs = docs;
    this.toks = docs.map(d => normaliser([d.titre, d.titre, ...(d.questions || []), d.reponse].join(" ")));
    this.avg = this.toks.reduce((s, t) => s + t.length, 0) / Math.max(1, this.toks.length);
    this.df = {};
    this.toks.forEach(t => new Set(t).forEach(w => this.df[w] = (this.df[w] || 0) + 1));
  }
  chercher(q, k = 3) {
    const qt = normaliser(q), N = this.docs.length, k1 = 1.4, b = 0.7;
    const res = this.toks.map((t, i) => {
      let s = 0; const tf = {};
      t.forEach(w => tf[w] = (tf[w] || 0) + 1);
      new Set(qt).forEach(w => {
        if (!tf[w]) return;
        const idf = Math.log(1 + (N - this.df[w] + .5) / (this.df[w] + .5));
        s += idf * tf[w] * (k1 + 1) / (tf[w] + k1 * (1 - b + b * t.length / this.avg));
      });
      return { doc: this.docs[i], score: s };
    }).filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, k);
    return { jetons: qt, resultats: res };
  }
}

const INTENTIONS = [
  { id: "salut", re: /^(bonjour|bonsoir|salut|hello|coucou|bjr|slt)\b/i },
  { id: "merci", re: /^(merci|thanks|super merci|parfait|top)\b/i },
  { id: "humain", re: /(conseiller|humain|agent|parler a quelqu|une vraie personne|appeler le service)/i },
  { id: "suivi", re: /(suivi|ticket|intervention|ou en est|LMO-?\d{4,})/i },
  { id: "eligibilite", re: /(eligib|disponible (a|dans|chez)|couvert|couverture|dans mon quartier|fibre (a|chez))/i },
  { id: "panne", re: /(panne|ne (marche|fonctionne) (plus|pas)|(plus|pas) (de )?(connexion|internet|reseau|wifi)|pas de (connexion|internet)|voyant|coupe|deconnect)/i }
];

function detecterIntention(q) {
  const n = q.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return (INTENTIONS.find(i => i.re.test(n)) || { id: "faq" }).id;
}

if (typeof module !== "undefined") module.exports = { normaliser, Index, detecterIntention };
