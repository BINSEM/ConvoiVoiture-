export const CalculatorService = {
  init() {
    // Attach listeners
    const inputs = document.querySelectorAll('#plannerCalculatorModal input, #plannerCalculatorModal select');
    inputs.forEach(input => {
      input.addEventListener('input', () => this.calculate());
      input.addEventListener('change', () => this.calculate());
    });
    this.calculate(); // initial
  },

  openModal() {
    const modal = document.getElementById('plannerCalculatorModal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      if (window.lucide) {
        window.lucide.createIcons();
      }
      this.init();
    }
  },

  closeModal() {
    const modal = document.getElementById('plannerCalculatorModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  },

  getVal(id) {
    const val = parseFloat(document.getElementById(id)?.value);
    return isNaN(val) ? 0 : val;
  },

  getCheckbox(id) {
    return document.getElementById(id)?.checked ? 1 : 0;
  },

  calculate() {
    // 1. Revenu
    const price = this.getVal('calc_price');

    // 2. Frais
    const costTrain = this.getVal('calc_train');
    const costBus = this.getVal('calc_bus');
    const costFuel = this.getVal('calc_fuel');
    const costToll = this.getVal('calc_toll');
    const costFood = this.getVal('calc_food');
    const costWear = this.getVal('calc_wear');
    const costOther = this.getVal('calc_other');

    const totalCost = costTrain + costBus + costFuel + costToll + costFood + costWear + costOther;
    const realProfit = price - totalCost;

    // 3. Temps (convertir tout en heures)
    const timeToDep = this.getVal('calc_t_dep') / 60;
    const timeInsp = this.getVal('calc_t_insp') / 60;
    
    const driveH = this.getVal('calc_t_drive_h');
    const driveM = this.getVal('calc_t_drive_m') / 60;
    const timeDrive = driveH + driveM;

    const timeDeliv = this.getVal('calc_t_deliv') / 60;
    
    const retH = this.getVal('calc_t_ret_h');
    const retM = this.getVal('calc_t_ret_m') / 60;
    const timeRet = retH + retM;

    const timeWait = this.getVal('calc_t_wait') / 60;

    const totalTimeHours = timeToDep + timeInsp + timeDrive + timeDeliv + timeRet + timeWait;
    
    let hourlyRate = 0;
    if (totalTimeHours > 0) {
      hourlyRate = realProfit / totalTimeHours;
    }

    // 4. Score
    let score = 0;
    if (this.getCheckbox('calc_crit_gare')) score += 2;
    if (this.getCheckbox('calc_crit_ret')) score += 3;
    if (this.getCheckbox('calc_crit_rur')) score -= 2;
    if (this.getCheckbox('calc_crit_tard')) score -= 1;
    if (this.getCheckbox('calc_crit_peage')) score -= 1;

    // Affichage des temps formatés
    const totalMinutes = Math.round(totalTimeHours * 60);
    const displayH = Math.floor(totalMinutes / 60);
    const displayM = totalMinutes % 60;
    document.getElementById('calc_res_time').innerText = `${displayH}h ${displayM < 10 ? '0' : ''}${displayM}`;

    document.getElementById('calc_res_profit').innerText = `${realProfit.toFixed(2)} €`;
    document.getElementById('calc_res_cost').innerText = `${totalCost.toFixed(2)} €`;
    document.getElementById('calc_res_hourly').innerText = `${hourlyRate.toFixed(2)} €/h`;
    document.getElementById('calc_res_score').innerText = `${score} pts`;

    // 5. Settings / Thresholds
    const minHourRate = this.getVal('calc_set_min_hour') || 10;
    const maxRetCostPercent = this.getVal('calc_set_max_ret') || 30; // ex: 30% du prix
    const minDistRate = this.getVal('calc_set_min_km') || 0.40;

    // Rentabilité Globale (Couleurs)
    // score <= 0 -> très mauvais, 1-3 -> moyen, > 3 -> bon
    let status = "Moyenne";
    let colorClass = "text-amber-500";
    let bgClass = "bg-amber-100 dark:bg-amber-900/30";

    const isGoodScore = score > 3;
    const isBadScore = score <= 0;
    const costPercent = price > 0 ? (totalCost / price) * 100 : 0;
    const dist = this.getVal('calc_dist');
    const kmRate = dist > 0 ? price / dist : 0;
    
    // Applying thresholds
    if (hourlyRate >= (minHourRate * 1.5) && isGoodScore && costPercent <= maxRetCostPercent) {
      status = "Excellente (Très Rentable)";
      colorClass = "text-emerald-500";
      bgClass = "bg-emerald-100 dark:bg-emerald-900/30";
    } 
    else if (hourlyRate >= minHourRate && (!dist || kmRate >= minDistRate) && costPercent <= maxRetCostPercent && score > 0) {
      status = "Rentable";
      colorClass = "text-emerald-500";
      bgClass = "bg-emerald-100 dark:bg-emerald-900/30";
    }
    else if (hourlyRate < minHourRate || isBadScore || costPercent > 50) {
      status = "À éviter (Non Rentable)";
      colorClass = "text-rose-500";
      bgClass = "bg-rose-100 dark:bg-rose-900/30";
    }

    const badge = document.getElementById('calc_res_global');
    if (badge) {
      badge.innerText = status;
      badge.className = `font-black text-sm px-3 py-1.5 rounded-lg ${bgClass} ${colorClass} text-center`;
    }
  }
};
window.CalculatorService = CalculatorService;
