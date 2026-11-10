const $ = (id) => document.getElementById(id);
const STORE_KEY = "balance-budget-v1";
const CATEGORIES = {
  needs: ["Housing","Utilities","Groceries","Transportation",
    "Insurance","Healthcare","Minimum debt payment","Other needs"],
  wants: ["Dining out","Shopping","Entertainment","Subscriptions",
    "Hobbies","Travel","Personal care","Other wants"],
  savings: ["Emergency fund","Savings","Investments",
    "Extra debt payment","Other savings"]
};
const COLORS = {needs:"#9bc7a5",wants:"#d2b77b",savings:"#91a9cf"};
const LABELS = {needs:"Needs",wants:"Wants",savings:"Savings"};
const money = n => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(n)||0);
const todayISO = () => new Date().toISOString().slice(0,10);
const currentMonth = () => todayISO().slice(0,7);
const monthLabel = m => new Date(`${m}-02T12:00:00`).toLocaleDateString("en-US",{month:"long",year:"numeric"});
const makeId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const blankState = () => ({months:{},goals:[],debts:[],recurring:[]});
let state = loadState();
let chart = null;

function loadState(){
  try { return {...blankState(),...JSON.parse(localStorage.getItem(STORE_KEY)||"{}")}; }
  catch { return blankState(); }
}
function saveState(){ localStorage.setItem(STORE_KEY,JSON.stringify(state)); }
function monthData(month=$("monthPicker").value){
  if(!state.months[month]) state.months[month]={income:0,transactions:[]};
  return state.months[month];
}
function categoryFor(type, category){
  if(type === "saving" || type === "debt") return "savings";
  if(["needs", "wants", "savings"].includes(category?.toLowerCase())){
    return category.toLowerCase();
  }
  return Object.entries(CATEGORIES).find(
    ([, items]) => items.includes(category)
  )?.[0] || "needs";
}
function allTransactions(month=$("monthPicker").value){return monthData(month).transactions;}
function setCategoryOptions(selected="Housing"){
  const select=$("transactionCategory");
  select.innerHTML="";
  Object.entries(CATEGORIES).forEach(([group,items])=>{
    const optgroup=document.createElement("optgroup"); optgroup.label=LABELS[group];
    items.forEach(item=>{const option=document.createElement("option");option.value=item;option.textContent=item;optgroup.append(option);});
    select.append(optgroup);
  });
  select.value=selected;
}
function getTotals(){
  const data=monthData(); const totals={needs:0,wants:0,savings:0};
  data.transactions.forEach(t=>{
    if(t.type==="income") return;
    const cat=categoryFor(t.type,t.budgetCategory);
    totals[cat]+=Number(t.amount)||0;
  });
  return {income:data.income,spent:totals.needs+totals.wants+totals.savings,totals};
}
function calculateBudgetPercentages() {
  const result = getTotals();
  const income = Number(result.income) || 0;

  if (income <= 0) {
    return {
      needs: 0,
      wants: 0,
      savings: 0
    };
  }

  return {
    needs: (result.totals.needs / income) * 100,
    wants: (result.totals.wants / income) * 100,
    savings: (result.totals.savings / income) * 100
  };
}
const percentages = calculateBudgetPercentages();

console.log(percentages.needs);
console.log(percentages.wants);
console.log(percentages.savings);

const budgetTargets = {
  needs: 50,
  wants: 30,
  savings: 20
};
function render(){
  const month=$("monthPicker").value; const {income,spent,totals}=getTotals();
  const budgets={needs:income*.5,wants:income*.3,savings:income*.2};
  $("incomeTotal").textContent=money(income);
  $("spentTotal").textContent=money(spent);
  $("remainingTotal").textContent=money(income-spent);
  $("savedTotal").textContent=money(totals.savings);
  $("savedFoot").textContent=`20% target: ${money(budgets.savings)}`;
  $("spentFoot").textContent=`${allTransactions().length} recorded transaction${allTransactions().length===1?"":"s"}`;
  $("monthGreeting").textContent=monthLabel(month).toUpperCase()+" AT A GLANCE";
  ["needs","wants","savings"].forEach(key=>{
    $(key+"Budget").textContent=money(budgets[key]);
    $(key+"Spent").textContent=money(totals[key])+(key==="savings"?" allocated":" spent");
    $(key+"Left").textContent=money(budgets[key]-totals[key])+" left";
    $(key+"Progress").style.width=(budgets[key]>0?Math.min(100,totals[key]/budgets[key]*100):0)+"%";
    $(key+"Progress").style.background=totals[key]>budgets[key]?"#d88787":COLORS[key];
  });
  renderTransactions(); renderChart(totals); renderGoals(); renderDebts(); renderRecurring(); renderHistory();
}
function renderTransactions(){
  const items=[...allTransactions()].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);
  const root=$("recentTransactions");
  if(!items.length){root.innerHTML='<div class="empty-state">No transactions yet. Add your first one to get started.</div>';return;}
  root.innerHTML=items.map(t=>{
    const symbol=t.type==="income"?"↗":t.type==="saving"?"✳":t.type==="debt"?"↘":"•";
    const sign=t.type==="income"?"+":"−";
    return `<div class="transaction-row"><div class="transaction-icon">${symbol}</div><div><div class="transaction-name">${escapeHTML(t.name)}</div><div class="transaction-sub">${escapeHTML(t.category||"Income")} · ${formatDate(t.date)}</div></div><div><div class="transaction-amount">${sign}${money(t.amount)}</div><div class="transaction-actions"><button class="tiny-action" data-edit-tx="${t.id}">Edit</button><button class="tiny-action" data-delete-tx="${t.id}">Delete</button></div></div></div>`;
  }).join("");
}
function renderChart(totals){
  const values=[totals.needs,totals.wants,totals.savings];
  $("chartTotal").textContent=money(values.reduce((a,b)=>a+b,0));
  $("chartLegend").innerHTML=Object.keys(LABELS).map(k=>`<span class="legend-item"><i class="legend-swatch" style="background:${COLORS[k]}"></i>${LABELS[k]}</span>`).join("");
  if(chart) chart.destroy();
  
  const percentages = calculateBudgetPercentages();

  const targets = {
    needs: 50,
    wants: 30,
    savings: 20
  };

  chart = new Chart($("spendingChart"), {
    type: "doughnut",
    data: {
      labels: Object.values(LABELS),
      datasets: [{
        data: values,
        backgroundColor: Object.values(COLORS),
        borderColor: "#171e19",
        borderWidth: 5,
        hoverOffset: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "76%",
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: c => {
              const keys = ["needs", "wants", "savings"];
              const key = keys[c.dataIndex];

              const spent = Number(c.raw) || 0;
              const actual = percentages[key] || 0;
              const target = targets[key];

              return [
                `${c.label}: ${money(spent)}`,
                `${actual.toFixed(1)}% of monthly income`,
                `Budget target: ${target}%`
              ];
            }
          }
        }
      }
    }
  });
}
function renderGoals(){
  const root=$("goalsList");
  if(!state.goals.length){root.innerHTML='<div class="panel empty-state">Create a goal for something you’re working toward.</div>';return;}
  root.innerHTML=state.goals.map(g=>{
    const pct=Math.min(100,g.target?g.current/g.target*100:0);
    return `<article class="goal-card"><div class="goal-top"><span class="goal-name">${escapeHTML(g.name)}</span><span class="goal-percent">${pct.toFixed(0)}%</span></div><div class="goal-numbers"><span>${money(g.current)} saved</span><span>${money(g.target)} goal</span></div><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div><div class="goal-actions"><button class="tiny-action" data-contribute="${g.id}">＋ Add savings</button><button class="tiny-action" data-delete-goal="${g.id}">Delete</button></div></article>`;
  }).join("");
}
function renderDebts(){
  const root=$("debtsList");
  if(!state.debts.length){root.innerHTML='<div class="empty-state">Add a debt to track your balance and progress.</div>';return;}
  root.innerHTML=state.debts.map(d=>{
    const paid=Math.max(0,d.start-d.current),pct=Math.min(100,d.start?paid/d.start*100:0);
    return `<div class="debt-row"><div><div class="row-title">${escapeHTML(d.name)}</div><div class="row-sub">${d.apr?`${d.apr}% APR`:"APR not entered"}</div></div><div><div class="row-value">${money(d.current)} remaining</div><div class="row-progress"><span style="width:${pct}%"></span></div></div><div class="row-sub">${pct.toFixed(0)}% paid off</div><div class="row-actions"><button class="tiny-action" data-pay-debt="${d.id}">＋ Payment</button><button class="tiny-action" data-delete-debt="${d.id}">Delete</button></div></div>`;
  }).join("");
}
function renderRecurring(){
  const root=$("recurringList");
  if(!state.recurring.length){root.innerHTML='<div class="empty-state">Add rent, subscriptions or other regular payments.</div>';return;}
  root.innerHTML=state.recurring.map(r=>`<div class="recurring-row"><div><div class="row-title">${escapeHTML(r.name)}</div><div class="row-sub">${LABELS[r.category]} · Due day ${r.day}</div></div><div class="row-value">${money(r.amount)} / month</div><div class="row-sub">Monthly</div><div class="row-actions"><button class="tiny-action" data-log-bill="${r.id}">＋ Log payment</button><button class="tiny-action" data-delete-bill="${r.id}">Delete</button></div></div>`).join("");
}
function renderHistory(){
  const root=$("historyList");
  const months=Object.keys(state.months).sort().reverse();
  if(!months.length){root.innerHTML='<div class="empty-state">Your monthly snapshots will appear here as you track your budget.</div>';return;}
  root.innerHTML=`<div class="history-row header"><span>Month</span><span>Income</span><span>Spent</span><span>Saved / debt</span></div>`+months.map(m=>{
    const d=state.months[m], spent=d.transactions.filter(t=>t.type!=="income").reduce((s,t)=>s+Number(t.amount),0);
    const saved=d.transactions.filter(t=>t.type==="saving"||t.type==="debt").reduce((s,t)=>s+Number(t.amount),0);
    return `<div class="history-row"><span>${monthLabel(m)}</span><span>${money(d.income)}</span><span>${money(spent)}</span><span>${money(saved)}</span></div>`;
  }).join("");
}
function formatDate(date){return new Date(date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"});}
function escapeHTML(value){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2400);}
function openDialog(id){$(id).showModal();}
function closeDialog(id){$(id).close();}
function addTransaction(data){
  const list=allTransactions(); const index=list.findIndex(t=>t.id===data.id);
  if(index>=0) list[index]=data; else list.push({...data,id:makeId()});
  saveState();render();toast(index>=0?"Transaction updated":"Transaction added");
}
function showTransaction(t=null){
  $("transactionForm").reset(); $("transactionId").value=t?.id||"";
  $("transactionTitle").textContent=t?"Edit transaction":"Add transaction";
  $("transactionName").value=t?.name||"";
  $("transactionAmount").value=t?.amount??"";
  $("transactionDate").value=t?.date||todayISO();
  $("transactionType").value=t?.type||"expense";
  setCategoryOptions(t?.category||"Housing");
  $("transactionNotes").value=t?.notes||"";
  openDialog("transactionDialog");
}
$("transactionType").addEventListener("change",()=>{
  const type=$("transactionType").value;
  if(type==="income") setCategoryOptions("Other needs");
  else if(type==="saving") setCategoryOptions("Savings");
  else if(type==="debt") setCategoryOptions("Extra debt payment");
});
$("transactionForm").addEventListener("submit",e=>{
  e.preventDefault();
  const type=$("transactionType").value, category=$("transactionCategory").value;
  addTransaction({id:$("transactionId").value||undefined,name:$("transactionName").value.trim(),amount:Number($("transactionAmount").value),date:$("transactionDate").value,type,category,budgetCategory:categoryFor(type,category),notes:$("transactionNotes").value.trim()});
  closeDialog("transactionDialog");
});

function calculateMonthlyIncome() {
  const type = $("incomeType").value;
  let monthlyIncome = 0;

  if (type === "hourly") {
    const rate = Number($("hourlyRate").value);
    const hours = Number($("weeklyHours").value);

    monthlyIncome = rate * hours * 52 / 12;
  } else {
    const amount = Number($("salaryAmount").value);
    const frequency = $("salaryFrequency").value;

    monthlyIncome = frequency === "annual"
      ? amount / 12
      : amount;
  }

  $("incomePreview").textContent = money(monthlyIncome);
  return monthlyIncome;
}

$("incomeType").addEventListener("change", () => {
  const isHourly = $("incomeType").value === "hourly";

  $("hourlyFields").style.display = isHourly ? "block" : "none";
  $("salaryFields").style.display = isHourly ? "none" : "block";

  calculateMonthlyIncome();
});

[
  "hourlyRate",
  "weeklyHours",
  "salaryAmount",
  "salaryFrequency"
].forEach(id => {
  $(id).addEventListener("input", calculateMonthlyIncome);
  $(id).addEventListener("change", calculateMonthlyIncome);
});

$("incomeForm").addEventListener("submit", e => {
  e.preventDefault();

  const income = calculateMonthlyIncome();

  if (!Number.isFinite(income) || income <= 0) {
    toast("Please enter a valid income amount");
    return;
  }

  monthData().income = income;
  saveState();
  render();
  closeDialog("incomeDialog");
  toast("Monthly income saved");
});

$("editIncomeBtn").addEventListener("click", () => {
  $("incomeForm").reset();
  $("incomeType").value = "hourly";
  $("hourlyFields").style.display = "block";
  $("salaryFields").style.display = "none";
  $("incomePreview").textContent = money(0);

  openDialog("incomeDialog");
});

["addExpenseTop","addExpenseLink"].forEach(id=>$(id).addEventListener("click",()=>showTransaction()));
$("monthPicker").value=currentMonth();
$("monthPicker").addEventListener("change",render);
$("today-label").textContent=new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"}).toUpperCase();
$("addGoalBtn").addEventListener("click",()=>{$("goalForm").reset();$("goalCurrent").value=0;openDialog("goalDialog");});
$("goalForm").addEventListener("submit",e=>{e.preventDefault();state.goals.push({id:makeId(),name:$("goalName").value.trim(),target:Number($("goalTarget").value),current:Number($("goalCurrent").value)});saveState();render();closeDialog("goalDialog");toast("Savings goal created");});
$("addDebtBtn").addEventListener("click",()=>{$("debtForm").reset();openDialog("debtDialog");});
$("debtForm").addEventListener("submit",e=>{e.preventDefault();state.debts.push({id:makeId(),name:$("debtName").value.trim(),start:Number($("debtStart").value),current:Number($("debtCurrent").value),apr:Number($("debtApr").value)||0});saveState();render();closeDialog("debtDialog");toast("Debt added to tracker");});
$("addRecurringBtn").addEventListener("click",()=>{$("recurringForm").reset();openDialog("recurringDialog");});
$("recurringForm").addEventListener("submit",e=>{e.preventDefault();state.recurring.push({id:makeId(),name:$("recurringName").value.trim(),amount:Number($("recurringAmount").value),day:Number($("recurringDay").value),category:$("recurringCategory").value});saveState();render();closeDialog("recurringDialog");toast("Recurring bill saved");});
document.addEventListener("click",e=>{
  const b=e.target.closest("button");if(!b)return;
  if(b.dataset.close){closeDialog(b.dataset.close);return;}
  if(b.dataset.editTx){const t=allTransactions().find(x=>x.id===b.dataset.editTx);if(t)showTransaction(t);}
  if(b.dataset.deleteTx){const d=allTransactions();const i=d.findIndex(x=>x.id===b.dataset.deleteTx);if(i>=0)d.splice(i,1);saveState();render();toast("Transaction deleted");}
  if(b.dataset.deleteGoal){state.goals=state.goals.filter(x=>x.id!==b.dataset.deleteGoal);saveState();render();}
  if(b.dataset.contribute){const g=state.goals.find(x=>x.id===b.dataset.contribute);const amount=Number(prompt(`How much would you like to add to ${g.name}?`));if(g&&amount>0){g.current+=amount;saveState();render();toast("Savings goal updated");}}
  if(b.dataset.deleteDebt){state.debts=state.debts.filter(x=>x.id!==b.dataset.deleteDebt);saveState();render();}
  if(b.dataset.payDebt){const d=state.debts.find(x=>x.id===b.dataset.payDebt);const amount=Number(prompt(`Payment amount for ${d.name}:`));if(d&&amount>0){d.current=Math.max(0,d.current-amount);addTransaction({name:`Debt payment: ${d.name}`,amount,date:todayISO(),type:"debt",category:"Extra debt payment",budgetCategory:"savings"});saveState();render();}}
  if(b.dataset.deleteBill){state.recurring=state.recurring.filter(x=>x.id!==b.dataset.deleteBill);saveState();render();}
  if(b.dataset.logBill){const r=state.recurring.find(x=>x.id===b.dataset.logBill);addTransaction({name:r.name,amount:r.amount,date:todayISO(),type:"expense",category:r.name,budgetCategory:r.category});}
});
render();
