const STORAGE_KEY = "skarbonka-app-state";

const defaultState = {
  goal: {
    name: "",
    amount: 0,
    celebrationShown: false,
  },
  transactions: [],
};

const badgeDefinitions = [
  {
    key: "first-income",
    name: "Pierwsza wpłata",
    description: "Dodaj pierwszą wpłatę do swojej skarbonki.",
    icon: "🐷",
    isUnlocked: (stats) => stats.incomeCount >= 1,
  },
  {
    key: "one-thousand",
    name: "1000 zł oszczędności",
    description: "Osiągnij saldo co najmniej 1000 zł.",
    icon: "💚",
    isUnlocked: (stats) => stats.balance >= 1000,
  },
  {
    key: "ten-transactions",
    name: "10 transakcji",
    description: "Zapisz łącznie przynajmniej dziesięć ruchów.",
    icon: "📘",
    isUnlocked: (stats) => stats.totalCount >= 10,
  },
  {
    key: "goal-halfway",
    name: "Połowa drogi",
    description: "Przekrocz 50% aktywnego celu oszczędzania.",
    icon: "🎯",
    isUnlocked: (stats) => stats.hasGoal && stats.goalProgress >= 50,
  },
];

const elements = {
  balanceAmount: document.getElementById("balanceAmount"),
  balanceBadge: document.getElementById("balanceBadge"),
  balanceHint: document.getElementById("balanceHint"),
  pigStatus: document.getElementById("pigStatus"),
  pigStage: document.getElementById("pigStage"),
  goalForm: document.getElementById("goalForm"),
  goalName: document.getElementById("goalName"),
  goalAmount: document.getElementById("goalAmount"),
  goalTitle: document.getElementById("goalTitle"),
  goalMessage: document.getElementById("goalMessage"),
  goalSubmit: document.getElementById("goalSubmit"),
  goalSaveState: document.getElementById("goalSaveState"),
  goalPercent: document.getElementById("goalPercent"),
  goalProgressFill: document.getElementById("goalProgressFill"),
  goalSaved: document.getElementById("goalSaved"),
  goalMissing: document.getElementById("goalMissing"),
  goalRatio: document.getElementById("goalRatio"),
  transactionForm: document.getElementById("transactionForm"),
  typeIncome: document.getElementById("typeIncome"),
  typeExpense: document.getElementById("typeExpense"),
  transactionAmount: document.getElementById("transactionAmount"),
  transactionDescription: document.getElementById("transactionDescription"),
  transactionDate: document.getElementById("transactionDate"),
  transactionMessage: document.getElementById("transactionMessage"),
  transactionSubmit: document.getElementById("transactionSubmit"),
  transactionSaveState: document.getElementById("transactionSaveState"),
  motivationCard: document.getElementById("motivationCard"),
  motivationTitle: document.getElementById("motivationTitle"),
  motivationText: document.getElementById("motivationText"),
  historyList: document.getElementById("historyList"),
  historyState: document.getElementById("historyState"),
  clearHistoryButton: document.getElementById("clearHistoryButton"),
  badgesGrid: document.getElementById("badgesGrid"),
  confettiLayer: document.getElementById("confettiLayer"),
};

let state = loadState();
let selectedType = "income";
let uiState = {
  savingGoal: false,
  savingTransaction: false,
  clearingHistory: false,
};

initializeApp();

function initializeApp() {
  setDefaultDate();
  bindEvents();
  hydrateGoalForm();
  render();
}

function bindEvents() {
  elements.goalForm.addEventListener("submit", handleGoalSubmit);
  elements.transactionForm.addEventListener("submit", handleTransactionSubmit);
  elements.typeIncome.addEventListener("click", () => setTransactionType("income"));
  elements.typeExpense.addEventListener("click", () => setTransactionType("expense"));
  elements.clearHistoryButton.addEventListener("click", handleClearHistory);

  [elements.goalName, elements.goalAmount, elements.transactionAmount, elements.transactionDescription, elements.transactionDate].forEach(
    (field) => {
      field.addEventListener("input", () => clearFieldError(field));
      field.addEventListener("change", () => clearFieldError(field));
    }
  );
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return cloneDefaultState();
    }

    const parsed = JSON.parse(raw);
    return {
      goal: {
        name: parsed.goal?.name ?? "",
        amount: sanitizeAmount(parsed.goal?.amount),
        celebrationShown: Boolean(parsed.goal?.celebrationShown),
      },
      transactions: Array.isArray(parsed.transactions)
        ? parsed.transactions
            .map((transaction) => ({
              id: String(transaction.id ?? crypto.randomUUID()),
              type: transaction.type === "expense" ? "expense" : "income",
              amount: sanitizeAmount(transaction.amount),
              description: String(transaction.description ?? "").trim(),
              date: String(transaction.date ?? ""),
              createdAt: String(transaction.createdAt ?? new Date().toISOString()),
            }))
            .filter(
              (transaction) =>
                transaction.amount > 0 &&
                transaction.description &&
                isValidDateString(transaction.date)
            )
        : [],
    };
  } catch (error) {
    console.error("Nie udało się wczytać danych aplikacji.", error);
    return cloneDefaultState();
  }
}

function cloneDefaultState() {
  return {
    goal: {
      name: "",
      amount: 0,
      celebrationShown: false,
    },
    transactions: [],
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function hydrateGoalForm() {
  elements.goalName.value = state.goal.name;
  elements.goalAmount.value = state.goal.amount > 0 ? state.goal.amount : "";
}

function render() {
  const stats = getStats();
  renderBalance(stats);
  renderGoal(stats);
  renderMotivation(stats);
  renderHistory();
  renderBadges(stats);
  renderUiState();
}

function renderBalance(stats) {
  elements.balanceAmount.textContent = formatCurrency(stats.balance);

  if (stats.balance > 0) {
    elements.balanceBadge.textContent = "Na plusie";
    elements.balanceBadge.className = "balance-badge positive";
    elements.balanceHint.textContent = "Twoje oszczędności rosną. Trzymaj tempo i pilnuj celu.";
  } else if (stats.balance < 0) {
    elements.balanceBadge.textContent = "Na minusie";
    elements.balanceBadge.className = "balance-badge negative";
    elements.balanceHint.textContent = "Spokojnie, jedna wpłata może szybko odwrócić ten wynik.";
  } else {
    elements.balanceBadge.textContent = "Na zero";
    elements.balanceBadge.className = "balance-badge neutral";
    elements.balanceHint.textContent = "Saldo czeka na pierwszy ruch. Zacznij od małej kwoty.";
  }

  if (stats.lastTransactionType === "income") {
    elements.pigStatus.textContent = "Wpłata zasiliła świnkę. Nawet mały krok pcha Cię do przodu.";
  } else if (stats.lastTransactionType === "expense") {
    elements.pigStatus.textContent = "Wydatek zabrał trochę monet, ale nadal możesz wrócić na dobry tor.";
  } else {
    elements.pigStatus.textContent = "Każda wpłata przybliża Cię do celu. Małe kwoty też robią różnicę.";
  }
}

function renderGoal(stats) {
  const hasGoal = state.goal.amount > 0 && state.goal.name;
  const percent = hasGoal ? Math.min(stats.goalProgress, 100) : 0;

  elements.goalTitle.textContent = hasGoal ? state.goal.name : "Ustaw swój cel";
  elements.goalPercent.textContent = `${Math.round(percent)}%`;
  elements.goalRatio.textContent = `${Math.round(percent)}%`;
  elements.goalProgressFill.style.width = `${percent}%`;
  elements.goalSaved.textContent = formatCurrency(Math.max(stats.balance, 0));
  elements.goalMissing.textContent = formatCurrency(hasGoal ? stats.goalMissing : 0);
}

function renderMotivation(stats) {
  elements.motivationCard.classList.toggle("is-complete", stats.goalCompleted);

  if (!stats.hasTransactions) {
    elements.motivationTitle.textContent = "Każda kwota ma znaczenie";
    elements.motivationText.textContent = "Wystarczy jeden ruch, żeby saldo zaczęło rosnąć.";
    return;
  }

  if (!stats.hasGoal) {
    elements.motivationTitle.textContent = "Masz już ruch na koncie";
    elements.motivationText.textContent =
      "Dodaj cel oszczędzania, a aplikacja pokaże Ci konkretnie ile jeszcze zostało.";
    return;
  }

  if (stats.goalCompleted) {
    elements.motivationTitle.textContent = "Cel osiągnięty!";
    elements.motivationText.textContent =
      "Brawo. Twoja skarbonka dowiozła plan. Możesz ustawić kolejny cel i iść dalej.";
    return;
  }

  elements.motivationTitle.textContent = "Jesteś coraz bliżej";
  elements.motivationText.textContent = `Do celu ${state.goal.name.toLowerCase()} brakuje jeszcze ${formatCurrency(
    stats.goalMissing
  )}.`;
}

function renderHistory() {
  const transactions = [...state.transactions].sort(sortTransactionsDesc);
  elements.historyList.innerHTML = "";

  if (!transactions.length) {
    elements.historyState.textContent = "Brak zapisanych transakcji.";
    return;
  }

  elements.historyState.textContent = `Łącznie zapisanych transakcji: ${transactions.length}.`;

  transactions.forEach((transaction) => {
    const item = document.createElement("li");
    item.className = "history-item";

    const typeLabel = transaction.type === "income" ? "Wpłata" : "Wydatek";
    const amountSign = transaction.type === "income" ? "+" : "-";

    item.innerHTML = `
      <div class="history-top">
        <span class="history-type ${transaction.type}">${typeLabel}</span>
        <span class="history-date">${formatDisplayDate(transaction.date)}</span>
      </div>
      <div class="history-bottom">
        <div class="history-description">${escapeHtml(transaction.description)}</div>
        <div class="history-amount ${transaction.type}">${amountSign}${formatCurrency(transaction.amount)}</div>
      </div>
    `;

    elements.historyList.appendChild(item);
  });
}

function renderBadges(stats) {
  elements.badgesGrid.innerHTML = "";

  badgeDefinitions.forEach((badge) => {
    const unlocked = badge.isUnlocked(stats);
    const badgeCard = document.createElement("article");
    badgeCard.className = `badge-card ${unlocked ? "unlocked" : "locked"}`;
    badgeCard.innerHTML = `
      <div class="badge-icon">${badge.icon}</div>
      <div class="badge-name">${badge.name}</div>
      <p class="badge-desc">${badge.description}</p>
      <strong>${unlocked ? "Odblokowana" : "Zablokowana"}</strong>
    `;
    elements.badgesGrid.appendChild(badgeCard);
  });
}

function renderUiState() {
  elements.goalSubmit.disabled = uiState.savingGoal;
  elements.transactionSubmit.disabled = uiState.savingTransaction;
  elements.clearHistoryButton.disabled = uiState.clearingHistory || state.transactions.length === 0;

  elements.goalSaveState.textContent = uiState.savingGoal ? "Zapisywanie..." : "Gotowe";
  elements.transactionSaveState.textContent = uiState.savingTransaction ? "Zapisywanie..." : "Gotowe";
}

function handleGoalSubmit(event) {
  event.preventDefault();

  const goalName = elements.goalName.value.trim();
  const goalAmount = sanitizeAmount(elements.goalAmount.value);

  clearMessage(elements.goalMessage);

  if (!goalName) {
    showFieldError(elements.goalName, "Podaj nazwę celu.");
    return;
  }

  if (!(goalAmount > 0)) {
    showFieldError(elements.goalAmount, "Kwota celu musi być większa od zera.");
    return;
  }

  setBusyState("savingGoal", true);

  const celebrationNeedsReset =
    state.goal.name !== goalName || Number(state.goal.amount) !== goalAmount;

  state.goal = {
    name: goalName,
    amount: goalAmount,
    celebrationShown: celebrationNeedsReset ? false : state.goal.celebrationShown,
  };

  saveState();
  render();
  maybeCelebrateGoal();

  window.setTimeout(() => {
    setBusyState("savingGoal", false);
    showMessage(elements.goalMessage, "Cel został zapisany.", true);
  }, 260);
}

function handleTransactionSubmit(event) {
  event.preventDefault();

  const amount = sanitizeAmount(elements.transactionAmount.value);
  const description = elements.transactionDescription.value.trim();
  const date = elements.transactionDate.value;

  clearMessage(elements.transactionMessage);

  if (!(amount > 0)) {
    showFieldError(elements.transactionAmount, "Kwota musi być większa od zera.");
    return;
  }

  if (!description) {
    showFieldError(elements.transactionDescription, "Opis jest obowiązkowy.");
    return;
  }

  if (!isValidDateString(date)) {
    showFieldError(elements.transactionDate, "Podaj poprawną datę.");
    return;
  }

  setBusyState("savingTransaction", true);

  const transaction = {
    id: crypto.randomUUID(),
    type: selectedType,
    amount,
    description,
    date,
    createdAt: new Date().toISOString(),
  };

  state.transactions.push(transaction);
  saveState();
  animatePig(selectedType);
  render();
  maybeCelebrateGoal();
  resetTransactionForm();

  window.setTimeout(() => {
    setBusyState("savingTransaction", false);
    showMessage(
      elements.transactionMessage,
      selectedType === "income" ? "Wpłata została dodana." : "Wydatek został dodany.",
      true
    );
  }, 260);
}

function handleClearHistory() {
  if (!state.transactions.length) {
    return;
  }

  const confirmed = window.confirm("Czy na pewno chcesz usunąć całą historię?");
  if (!confirmed) {
    return;
  }

  setBusyState("clearingHistory", true);

  window.setTimeout(() => {
    state.transactions = [];
    saveState();
    render();
    setDefaultDate();
    setBusyState("clearingHistory", false);
    showMessage(elements.transactionMessage, "Historia została wyczyszczona.", true);
  }, 220);
}

function setTransactionType(type) {
  selectedType = type;
  elements.typeIncome.classList.toggle("active", type === "income");
  elements.typeIncome.setAttribute("aria-pressed", String(type === "income"));
  elements.typeExpense.classList.toggle("active", type === "expense");
  elements.typeExpense.setAttribute("aria-pressed", String(type === "expense"));
}

function resetTransactionForm() {
  elements.transactionAmount.value = "";
  elements.transactionDescription.value = "";
  setDefaultDate();
  setTransactionType("income");
}

function setDefaultDate() {
  elements.transactionDate.value = getTodayDateString();
}

function maybeCelebrateGoal() {
  const stats = getStats();
  if (!stats.goalCompleted || state.goal.celebrationShown || !stats.hasGoal) {
    return;
  }

  state.goal.celebrationShown = true;
  saveState();
  burstConfetti();
}

function burstConfetti() {
  const colors = ["#59d98a", "#f4c95d", "#ff7b75", "#f4f7f3"];
  elements.confettiLayer.innerHTML = "";

  for (let index = 0; index < 26; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[index % colors.length];
    piece.style.animationDelay = `${Math.random() * 220}ms`;
    piece.style.transform = `translateY(0) rotate(${Math.random() * 180}deg)`;
    elements.confettiLayer.appendChild(piece);
  }

  window.setTimeout(() => {
    elements.confettiLayer.innerHTML = "";
  }, 1800);
}

function animatePig(type) {
  const className = type === "income" ? "animate-income" : "animate-expense";
  elements.pigStage.classList.remove("animate-income", "animate-expense");

  requestAnimationFrame(() => {
    elements.pigStage.classList.add(className);
    window.setTimeout(() => {
      elements.pigStage.classList.remove(className);
    }, 980);
  });
}

function getStats() {
  const totals = state.transactions.reduce(
    (accumulator, transaction) => {
      if (transaction.type === "income") {
        accumulator.incomeTotal += transaction.amount;
        accumulator.incomeCount += 1;
      } else {
        accumulator.expenseTotal += transaction.amount;
        accumulator.expenseCount += 1;
      }
      return accumulator;
    },
    {
      incomeTotal: 0,
      expenseTotal: 0,
      incomeCount: 0,
      expenseCount: 0,
    }
  );

  const balance = totals.incomeTotal - totals.expenseTotal;
  const hasGoal = state.goal.amount > 0 && state.goal.name.trim().length > 0;
  const goalProgress = hasGoal ? (Math.max(balance, 0) / state.goal.amount) * 100 : 0;
  const goalMissing = hasGoal ? Math.max(state.goal.amount - Math.max(balance, 0), 0) : 0;
  const goalCompleted = hasGoal && Math.max(balance, 0) >= state.goal.amount;
  const sortedTransactions = [...state.transactions].sort(sortTransactionsDesc);

  return {
    balance,
    incomeCount: totals.incomeCount,
    expenseCount: totals.expenseCount,
    totalCount: state.transactions.length,
    hasTransactions: state.transactions.length > 0,
    hasGoal,
    goalProgress,
    goalMissing,
    goalCompleted,
    lastTransactionType: sortedTransactions[0]?.type ?? null,
  };
}

function sortTransactionsDesc(left, right) {
  const leftTime = new Date(`${left.date}T00:00:00`).getTime();
  const rightTime = new Date(`${right.date}T00:00:00`).getTime();
  if (leftTime !== rightTime) {
    return rightTime - leftTime;
  }
  return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
}

function sanitizeAmount(value) {
  const normalized = String(value ?? "")
    .replace(",", ".")
    .trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDisplayDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getTodayDateString() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  const adjusted = new Date(today.getTime() - offset * 60_000);
  return adjusted.toISOString().slice(0, 10);
}

function showFieldError(field, message) {
  field.classList.add("is-invalid");
  showMessage(
    field.form === elements.goalForm ? elements.goalMessage : elements.transactionMessage,
    message,
    false
  );
  field.focus();
}

function clearFieldError(field) {
  field.classList.remove("is-invalid");
}

function showMessage(container, message, isSuccess) {
  container.textContent = message;
  container.classList.toggle("success", isSuccess);
}

function clearMessage(container) {
  container.textContent = "";
  container.classList.remove("success");
}

function setBusyState(key, value) {
  uiState[key] = value;
  renderUiState();
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}