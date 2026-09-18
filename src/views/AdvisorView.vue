<template>
  <div class="advisor-container">
    <div class="form-section">
      <h2>Vergabe-Advisor</h2>
      <div class="form-group">
        <label>
          Leistungsart
          <span class="tooltip-icon" :title="tooltipText">?</span>
        </label>
        <select v-model="leistungsart">
          <option value="">-- Bitte wählen --</option>
          <option value="bau">Bauleistungen (VOB/A)</option>
          <option value="lieferung">Lieferungen & Dienstleistungen</option>
          <option value="freiberuflich">Freiberuflich/Planung (§ 73 VgV)</option>
          <option value="konzession">Konzessionen</option>
        </select>
      </div>
      <div class="form-group">
        <label>Volumen (€)</label>
        <input v-model="volumen" type="number" placeholder="z.B. 300000">
      </div>
      <button @click="analyze" class="btn-analyze">Analysieren</button>
    </div>
    <div v-if="result" class="result-section">
      <div class="result-card">
        <h3>Ergebnis</h3>
        <p><strong>Leistungsart:</strong> {{ result.leistungsart }}</p>
        <p><strong>Schwellenwert:</strong> {{ result.schwellenwert }}</p>
        <p><strong>Verfahrensart:</strong> {{ result.verfahrensart }}</p>
        <p v-if="result.beschreibung" class="description">{{ result.beschreibung }}</p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AdvisorView',
  data() {
    return {
      leistungsart: '',
      volumen: null,
      result: null,
      tooltipText: 'Bauleistungen: €5.404.000 | Lieferungen/Dienstleistungen: €216.000 | Freiberuflich/Planung: €216.000 | Konzessionen: €5.404.000'
    };
  },
  methods: {
    analyze() {
      if (!this.leistungsart || !this.volumen) {
        alert('Bitte alle Felder ausfüllen');
        return;
      }
      const schwellenwerte = { bau: 5404000, lieferung: 216000, freiberuflich: 216000, konzession: 5404000 };
      const labels = { bau: 'Bauleistungen (VOB/A)', lieferung: 'Lieferungen & Dienstleistungen', freiberuflich: 'Freiberuflich/Planung', konzession: 'Konzessionen' };
      const schwelle = schwellenwerte[this.leistungsart];
      const volumen = parseInt(this.volumen);
      let verfahrensart = '', beschreibung = '';
      if (volumen < schwelle) {
        verfahrensart = 'Unterhalb Schwellenwert - Nationale Ausschreibung';
        beschreibung = `Das Volumen liegt unter dem EU-Schwellenwert (€${schwelle.toLocaleString('de-DE')}). VOB/A oder Regelwerk des Auftraggebers gilt.`;
      } else {
        verfahrensart = 'EU-weite Ausschreibung';
        beschreibung = `Das Volumen überschreitet den Schwellenwert (€${schwelle.toLocaleString('de-DE')}). VgV/KonzVgV erforderlich.`;
      }
      this.result = { leistungsart: labels[this.leistungsart], schwellenwert: `€${schwelle.toLocaleString('de-DE')}`, volumen: `€${volumen.toLocaleString('de-DE')}`, verfahrensart, beschreibung };
    }
  }
};
</script>

<style scoped>
.advisor-container { max-width: 800px; margin: 40px auto; padding: 20px; }
.form-section { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.form-group { margin-bottom: 20px; }
label { display: block; margin-bottom: 8px; font-weight: 500; color: #333; }
.tooltip-icon { display: inline-block; width: 20px; height: 20px; background: #06B6D4; color: white; border-radius: 50%; text-align: center; line-height: 20px; cursor: help; margin-left: 6px; font-size: 12px; font-weight: bold; }
.tooltip-icon:hover { background: #0891b2; }
input, select { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
input:focus, select:focus { outline: none; border-color: #06B6D4; }
.btn-analyze { width: 100%; padding: 12px; background: #06B6D4; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; }
.btn-analyze:hover { background: #0891b2; }
.result-section { margin-top: 30px; }
.result-card { background: #f0f9fc; border-left: 4px solid #06B6D4; padding: 20px; border-radius: 4px; }
.result-card h3 { margin-top: 0; color: #06B6D4; }
.result-card p { margin: 10px 0; line-height: 1.6; }
.description { background: white; padding: 15px; border-radius: 4px; margin-top: 15px; font-size: 14px; color: #555; }
</style>
