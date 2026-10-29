import {
    api,
    errorMessage,
    formatDate,
    formatNumber,
    redirectToLogin,
    todayInputValue,
} from "./api.js";

const state = {
    user: null,
    items: [],
    total: 0,
    limit: 6,
    loading: false,
    listRequest: 0,
    editingId: null,
    historyRequest: 0,
};

const refs = {
    currentUsername: document.querySelector("#current-username"),
    logoutButton: document.querySelector("#logout-button"),
    heroTotal: document.querySelector("#hero-total"),
    statsGrid: document.querySelector("#stats-grid"),
    statsCategories: document.querySelector("#stats-categories"),
    workoutForm: document.querySelector("#workout-form"),
    workoutFormError: document.querySelector("#workout-form-error"),
    workoutSubmit: document.querySelector("#workout-submit"),
    workoutDate: document.querySelector("#workout-date"),
    workoutNotes: document.querySelector("#workout-notes"),
    filterForm: document.querySelector("#filter-form"),
    list: document.querySelector("#workout-list"),
    listCount: document.querySelector("#list-count"),
    listLoading: document.querySelector("#list-loading"),
    listError: document.querySelector("#list-error"),
    listEmpty: document.querySelector("#list-empty"),
    loadMore: document.querySelector("#load-more"),
    editDialog: document.querySelector("#edit-dialog"),
    editForm: document.querySelector("#edit-form"),
    editTitle: document.querySelector("#edit-title"),
    editDate: document.querySelector("#edit-date"),
    editDuration: document.querySelector("#edit-duration"),
    editCategory: document.querySelector("#edit-category"),
    editNotes: document.querySelector("#edit-notes"),
    editCompleted: document.querySelector("#edit-completed"),
    editError: document.querySelector("#edit-form-error"),
    editSubmit: document.querySelector("#edit-submit"),
    historyDialog: document.querySelector("#history-dialog"),
    historyTitle: document.querySelector("#history-title"),
    historySummary: document.querySelector("#history-summary"),
    historyList: document.querySelector("#history-list"),
    historyLoading: document.querySelector("#history-loading"),
    historyEmpty: document.querySelector("#history-empty"),
    historyError: document.querySelector("#history-error"),
    toast: document.querySelector("#toast"),
};

let toastTimer = null;

function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) {
        element.className = className;
    }
    if (text !== undefined) {
        element.textContent = text;
    }
    return element;
}

function setDefaultWorkoutDate() {
    const today = todayInputValue();
    refs.workoutDate.value = today;
    refs.workoutDate.defaultValue = today;
}

function showToast(message, type = "success") {
    window.clearTimeout(toastTimer);
    refs.toast.textContent = message;
    refs.toast.className = type === "error" ? "toast toast--error" : "toast";
    refs.toast.hidden = false;
    toastTimer = window.setTimeout(() => {
        refs.toast.hidden = true;
    }, 4200);
}

function handleAuthError(error) {
    if (error && error.status === 401) {
        redirectToLogin();
        return true;
    }
    return false;
}

function showStatsSkeleton() {
    refs.statsGrid.replaceChildren();
    for (let index = 0; index < 4; index += 1) {
        refs.statsGrid.append(createElement("div", "stat-skeleton"));
    }
}

function makeStatCard(label, value, hint) {
    const card = createElement("article", "stat-card");
    card.append(
        createElement("p", "stat-card__label", label),
        createElement("p", "stat-card__value", value),
        createElement("p", "stat-card__hint", hint),
    );
    return card;
}

async function loadStats() {
    try {
        const stats = await api("/api/workouts/stats");
        renderStats(stats);
    } catch (error) {
        if (handleAuthError(error)) {
            return;
        }
        refs.statsGrid.replaceChildren();
        const errorBox = createElement("div", "state-box state-box--error", errorMessage(error));
        errorBox.style.gridColumn = "1 / -1";
        refs.statsGrid.append(errorBox);
        refs.statsCategories.hidden = true;
        refs.heroTotal.textContent = "—";
    }
}

function renderStats(stats) {
    const completion = stats.total_workouts
        ? Math.round((stats.completed_workouts / stats.total_workouts) * 100)
        : 0;

    refs.statsGrid.replaceChildren(
        makeStatCard("Всего тренировок", formatNumber(stats.total_workouts), "в личном дневнике"),
        makeStatCard("Выполнено", formatNumber(stats.completed_workouts), `${completion}% от всех записей`),
        makeStatCard(
            "Суммарный объём",
            `${formatNumber(stats.total_volume_kg)} кг`,
            "вес × повторения × подходы",
        ),
        makeStatCard(
            "Средняя длительность",
            `${formatNumber(stats.average_duration_minutes, 1)} мин`,
            `Всего ${formatNumber(stats.total_duration_minutes)} мин`,
        ),
    );

    refs.heroTotal.textContent = formatNumber(stats.total_workouts);
    renderCategoryStats(stats.categories);
}

function renderCategoryStats(categories) {
    refs.statsCategories.replaceChildren();
    if (!categories.length) {
        refs.statsCategories.hidden = true;
        return;
    }

    refs.statsCategories.hidden = false;
    refs.statsCategories.append(createElement("strong", "category-heading", "По категориям"));
    categories.forEach((category) => {
        const row = createElement("div", "category-row");
        const meta = [
            `${formatNumber(category.workout_count)} тренировок`,
            `${formatNumber(category.total_duration_minutes)} мин`,
            `${formatNumber(category.total_volume_kg)} кг`,
        ].join(" · ");
        row.append(
            createElement("strong", "", category.category),
            createElement("span", "", meta),
        );
        refs.statsCategories.append(row);
    });
}

function readSort() {
    const value = refs.filterForm.elements.sort.value || "date_desc";
    const parts = value.split("_");
    return {
        sortBy: parts[0] || "date",
        order: parts[1] || "desc",
    };
}

function buildListParams(offset) {
    const formData = new FormData(refs.filterForm);
    const sort = readSort();
    const params = new URLSearchParams({
        sort_by: sort.sortBy,
        order: sort.order,
        limit: String(state.limit),
        offset: String(offset),
    });

    ["q", "category", "completed", "date_from", "date_to"].forEach((name) => {
        const value = String(formData.get(name) || "").trim();
        if (value) {
            params.set(name, value);
        }
    });

    return params;
}

async function loadWorkouts({ reset = false } = {}) {
    if (!reset && state.loading) {
        return;
    }

    const requestId = state.listRequest + 1;
    state.listRequest = requestId;
    state.loading = true;

    const offset = reset ? 0 : state.items.length;
    if (reset) {
        state.items = [];
        state.total = 0;
        refs.list.replaceChildren();
        refs.listError.hidden = true;
        refs.listEmpty.hidden = true;
        refs.listLoading.hidden = false;
        refs.listCount.textContent = "Загрузка списка...";
    } else {
        refs.loadMore.disabled = true;
        refs.loadMore.textContent = "Загрузка...";
    }

    try {
        const data = await api(`/api/workouts?${buildListParams(offset).toString()}`);
        if (requestId !== state.listRequest) {
            return;
        }
        state.items.push(...data.items);
        state.total = data.total;
        renderWorkouts();
    } catch (error) {
        if (requestId !== state.listRequest) {
            return;
        }
        if (handleAuthError(error)) {
            return;
        }
        if (reset) {
            refs.listError.textContent = errorMessage(error);
            refs.listError.hidden = false;
            refs.listCount.textContent = "Не удалось загрузить список";
            refs.listEmpty.hidden = true;
        }
        showToast(errorMessage(error), "error");
    } finally {
        if (requestId === state.listRequest) {
            state.loading = false;
            refs.listLoading.hidden = true;
            refs.loadMore.disabled = false;
            refs.loadMore.textContent = "Показать ещё";
        }
    }
}

function renderWorkouts() {
    refs.list.replaceChildren();

    if (!state.items.length) {
        refs.listEmpty.hidden = false;
        refs.listCount.textContent = "0 тренировок";
        refs.loadMore.hidden = true;
        return;
    }

    refs.listEmpty.hidden = true;
    state.items.forEach((workout) => {
        refs.list.append(createWorkoutCard(workout));
    });

    refs.listCount.textContent = `Показано ${state.items.length} из ${state.total}`;
    refs.loadMore.hidden = state.items.length >= state.total;
}

function createWorkoutCard(workout) {
    const card = createElement("article", "workout-card");
    const head = createElement("div", "workout-card__head");
    const heading = createElement("div", "workout-card__heading");

    const title = createElement("h3", "workout-card__title", workout.title);
    const date = createElement("p", "workout-card__date", formatDate(workout.workout_date));
    heading.append(title, date);

    const actions = createElement("div", "workout-card__actions");
    const editButton = createElement("button", "btn btn--ghost btn--small", "Изменить");
    editButton.type = "button";
    editButton.addEventListener("click", () => openEditDialog(workout));

    const deleteButton = createElement("button", "btn btn--danger btn--small", "Удалить");
    deleteButton.type = "button";
    deleteButton.addEventListener("click", () => deleteWorkout(workout));

    actions.append(editButton, deleteButton);
    head.append(heading, actions);

    const chips = createElement("div", "chips");
    chips.append(
        createElement("span", "chip chip--category", workout.category),
        createElement("span", "chip chip--volume", `${formatNumber(workout.duration_minutes)} мин`),
        createElement(
            "span",
            workout.completed ? "chip chip--done" : "chip chip--planned",
            workout.completed ? "Выполнена" : "Запланирована",
        ),
        createElement("span", "chip chip--volume", `Объём: ${formatNumber(workout.total_volume)} кг`),
    );

    card.append(head, chips);

    if (workout.notes) {
        card.append(createElement("p", "workout-notes", workout.notes));
    }

    card.append(createExerciseSection(workout));
    return card;
}

function createExerciseSection(workout) {
    const section = createElement("section", "exercise-section");
    const sectionHead = createElement("div", "exercise-section__head");
    const headingText = workout.exercise_count
        ? `Упражнения · ${workout.exercise_count}`
        : "Упражнения";
    sectionHead.append(createElement("h4", "", headingText));
    section.append(sectionHead);

    if (!workout.exercises.length) {
        section.append(createElement("p", "exercise-empty", "Упражнения пока не добавлены."));
    } else {
        const list = createElement("div", "exercise-list");
        workout.exercises.forEach((exercise) => {
            list.append(createExerciseRow(workout, exercise));
        });
        section.append(list);
    }

    section.append(createExerciseForm(workout));
    return section;
}

function createExerciseRow(workout, exercise) {
    const row = createElement("div", "exercise-row");
    const main = createElement("div", "exercise-row__main");
    main.append(
        createElement("strong", "exercise-row__name", exercise.name),
        createElement(
            "span",
            "exercise-row__details",
            `${exercise.sets} × ${exercise.reps} · ${formatNumber(exercise.weight_kg, 1)} кг`,
        ),
    );

    const volume = createElement(
        "span",
        "exercise-row__volume",
        `${formatNumber(exercise.volume)} кг`,
    );

    const actions = createElement("div", "exercise-row__actions");
    const historyButton = createElement("button", "btn btn--ghost btn--small", "История");
    historyButton.type = "button";
    historyButton.addEventListener("click", () => openHistory(exercise.name));

    const deleteButton = createElement("button", "btn btn--danger btn--small", "Удалить");
    deleteButton.type = "button";
    deleteButton.addEventListener("click", () => deleteExercise(workout, exercise));

    actions.append(historyButton, deleteButton);
    row.append(main, volume, actions);
    return row;
}

function createExerciseForm(workout) {
    const wrapper = document.createElement("details");
    wrapper.className = "exercise-form-wrap";
    wrapper.append(createElement("summary", "", "Добавить упражнение"));

    const form = document.createElement("form");
    form.className = "exercise-form";
    form.noValidate = true;

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.name = "name";
    nameInput.maxLength = 100;
    nameInput.placeholder = "Жим лёжа";
    nameInput.required = true;

    const weightInput = document.createElement("input");
    weightInput.type = "number";
    weightInput.name = "weight_kg";
    weightInput.min = "0";
    weightInput.max = "2000";
    weightInput.step = "0.5";
    weightInput.value = "0";
    weightInput.required = true;

    const repsInput = document.createElement("input");
    repsInput.type = "number";
    repsInput.name = "reps";
    repsInput.min = "1";
    repsInput.max = "10000";
    repsInput.value = "10";
    repsInput.required = true;

    const setsInput = document.createElement("input");
    setsInput.type = "number";
    setsInput.name = "sets";
    setsInput.min = "1";
    setsInput.max = "1000";
    setsInput.value = "3";
    setsInput.required = true;

    const submitButton = createElement("button", "btn btn--primary", "Добавить");
    submitButton.type = "submit";

    const errorBox = createElement("p", "form-error", "");
    errorBox.hidden = true;

    form.append(
        makeField("Упражнение", nameInput),
        makeField("Вес, кг", weightInput),
        makeField("Повторы", repsInput),
        makeField("Подходы", setsInput),
        submitButton,
        errorBox,
    );

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        errorBox.hidden = true;

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        submitButton.disabled = true;
        try {
            await api(`/api/workouts/${workout.id}/exercises`, {
                method: "POST",
                body: {
                    name: nameInput.value.trim(),
                    weight_kg: Number(weightInput.value),
                    reps: Number(repsInput.value),
                    sets: Number(setsInput.value),
                },
            });
            showToast("Упражнение добавлено");
            await refreshAll();
        } catch (error) {
            if (handleAuthError(error)) {
                return;
            }
            errorBox.textContent = errorMessage(error);
            errorBox.hidden = false;
        } finally {
            submitButton.disabled = false;
        }
    });

    wrapper.append(form);
    return wrapper;
}

function makeField(labelText, input) {
    const label = document.createElement("label");
    label.className = "field";
    label.append(createElement("span", "", labelText), input);
    return label;
}

function openEditDialog(workout) {
    state.editingId = workout.id;
    refs.editTitle.value = workout.title;
    refs.editDate.value = workout.workout_date;
    refs.editDuration.value = String(workout.duration_minutes);
    refs.editCategory.value = workout.category;
    refs.editNotes.value = workout.notes || "";
    refs.editCompleted.checked = workout.completed;
    refs.editError.hidden = true;
    refs.editDialog.showModal();
    refs.editTitle.focus();
}

async function handleEditSubmit(event) {
    event.preventDefault();
    refs.editError.hidden = true;

    if (!refs.editForm.checkValidity()) {
        refs.editForm.reportValidity();
        return;
    }
    if (state.editingId === null) {
        return;
    }

    refs.editSubmit.disabled = true;
    refs.editSubmit.textContent = "Сохраняем...";

    try {
        await api(`/api/workouts/${state.editingId}`, {
            method: "PATCH",
            body: {
                title: refs.editTitle.value.trim(),
                workout_date: refs.editDate.value,
                duration_minutes: Number(refs.editDuration.value),
                category: refs.editCategory.value.trim(),
                notes: refs.editNotes.value.trim() || null,
                completed: refs.editCompleted.checked,
            },
        });
        refs.editDialog.close();
        showToast("Тренировка обновлена");
        await refreshAll();
    } catch (error) {
        if (handleAuthError(error)) {
            return;
        }
        refs.editError.textContent = errorMessage(error);
        refs.editError.hidden = false;
    } finally {
        refs.editSubmit.disabled = false;
        refs.editSubmit.textContent = "Сохранить";
    }
}

async function deleteWorkout(workout) {
    if (!window.confirm(`Удалить тренировку «${workout.title}»?`)) {
        return;
    }
    try {
        await api(`/api/workouts/${workout.id}`, { method: "DELETE" });
        showToast("Тренировка удалена");
        await refreshAll();
    } catch (error) {
        if (handleAuthError(error)) {
            return;
        }
        showToast(errorMessage(error), "error");
    }
}

async function deleteExercise(workout, exercise) {
    if (!window.confirm(`Удалить упражнение «${exercise.name}» из тренировки «${workout.title}»?`)) {
        return;
    }
    try {
        await api(`/api/exercises/${exercise.id}`, { method: "DELETE" });
        showToast("Упражнение удалено");
        await refreshAll();
    } catch (error) {
        if (handleAuthError(error)) {
            return;
        }
        showToast(errorMessage(error), "error");
    }
}

async function openHistory(name) {
    const requestId = state.historyRequest + 1;
    state.historyRequest = requestId;

    refs.historyTitle.textContent = `История: ${name}`;
    refs.historySummary.replaceChildren();
    refs.historyList.replaceChildren();
    refs.historyError.hidden = true;
    refs.historyEmpty.hidden = true;
    refs.historyLoading.hidden = false;

    if (!refs.historyDialog.open) {
        refs.historyDialog.showModal();
    }

    try {
        const params = new URLSearchParams({ name, limit: "50" });
        const history = await api(`/api/exercises/history?${params.toString()}`);
        if (requestId !== state.historyRequest) {
            return;
        }
        renderHistory(history);
    } catch (error) {
        if (requestId !== state.historyRequest) {
            return;
        }
        if (handleAuthError(error)) {
            return;
        }
        refs.historyError.textContent = errorMessage(error);
        refs.historyError.hidden = false;
    } finally {
        if (requestId === state.historyRequest) {
            refs.historyLoading.hidden = true;
        }
    }
}

function makeHistoryStat(label, value) {
    const card = createElement("div", "history-stat");
    card.append(
        createElement("span", "", label),
        createElement("strong", "", value),
    );
    return card;
}

function renderHistory(history) {
    refs.historySummary.replaceChildren(
        makeHistoryStat("Сессий", formatNumber(history.sessions)),
        makeHistoryStat("Общий объём", `${formatNumber(history.total_volume_kg)} кг`),
        makeHistoryStat("Лучший вес", `${formatNumber(history.best_weight_kg, 1)} кг`),
    );

    refs.historyList.replaceChildren();
    if (!history.items.length) {
        refs.historyEmpty.hidden = false;
        return;
    }

    refs.historyEmpty.hidden = true;
    history.items.forEach((item) => {
        const row = createElement("div", "history-row");
        const main = createElement("div", "");
        main.append(
            createElement("strong", "history-row__title", item.workout_title),
            createElement("span", "history-row__date", formatDate(item.workout_date)),
        );

        const metrics = createElement("div", "history-row__metrics");
        metrics.append(
            createElement(
                "span",
                "",
                `${formatNumber(item.weight_kg, 1)} кг × ${item.reps} × ${item.sets}`,
            ),
            createElement("strong", "", `${formatNumber(item.volume)} кг`),
        );

        row.append(main, metrics);
        refs.historyList.append(row);
    });
}

async function handleWorkoutSubmit(event) {
    event.preventDefault();
    refs.workoutFormError.hidden = true;

    if (!refs.workoutForm.checkValidity()) {
        refs.workoutForm.reportValidity();
        return;
    }

    const formData = new FormData(refs.workoutForm);
    refs.workoutSubmit.disabled = true;
    refs.workoutSubmit.textContent = "Сохраняем...";

    try {
        await api("/api/workouts", {
            method: "POST",
            body: {
                title: String(formData.get("title") || "").trim(),
                workout_date: String(formData.get("workout_date") || ""),
                category: String(formData.get("category") || "").trim(),
                duration_minutes: Number(formData.get("duration_minutes")),
                notes: String(formData.get("notes") || "").trim() || null,
                completed: refs.workoutForm.elements.completed.checked,
            },
        });
        refs.workoutForm.reset();
        setDefaultWorkoutDate();
        refs.workoutNotes.value = "";
        showToast("Тренировка добавлена");
        await refreshAll();
    } catch (error) {
        if (handleAuthError(error)) {
            return;
        }
        refs.workoutFormError.textContent = errorMessage(error);
        refs.workoutFormError.hidden = false;
    } finally {
        refs.workoutSubmit.disabled = false;
        refs.workoutSubmit.textContent = "Добавить тренировку";
    }
}

async function refreshAll() {
    await Promise.all([loadStats(), loadWorkouts({ reset: true })]);
}

async function logout() {
    refs.logoutButton.disabled = true;
    try {
        await api("/api/auth/logout", { method: "POST" });
    } catch {
        refs.logoutButton.disabled = false;
    } finally {
        redirectToLogin();
    }
}

function bindEvents() {
    refs.workoutForm.addEventListener("submit", handleWorkoutSubmit);
    refs.editForm.addEventListener("submit", handleEditSubmit);
    refs.logoutButton.addEventListener("click", logout);
    refs.loadMore.addEventListener("click", () => loadWorkouts());
    refs.filterForm.addEventListener("submit", (event) => {
        event.preventDefault();
        loadWorkouts({ reset: true });
    });
    refs.filterForm.addEventListener("reset", () => {
        window.setTimeout(() => loadWorkouts({ reset: true }), 0);
    });
    document.querySelectorAll("[data-close-dialog]").forEach((button) => {
        button.addEventListener("click", () => {
            const dialog = button.closest("dialog");
            if (dialog) {
                dialog.close();
            }
        });
    });
    refs.editDialog.addEventListener("click", (event) => {
        if (event.target === refs.editDialog) {
            refs.editDialog.close();
        }
    });
    refs.historyDialog.addEventListener("click", (event) => {
        if (event.target === refs.historyDialog) {
            refs.historyDialog.close();
        }
    });
    refs.historyDialog.addEventListener("close", () => {
        state.historyRequest += 1;
    });
}

async function init() {
    bindEvents();
    setDefaultWorkoutDate();
    showStatsSkeleton();

    try {
        state.user = await api("/api/auth/me");
    } catch (error) {
        if (handleAuthError(error)) {
            return;
        }
        refs.listLoading.hidden = true;
        refs.listError.textContent = errorMessage(error);
        refs.listError.hidden = false;
        return;
    }

    refs.currentUsername.textContent = state.user.username;
    await refreshAll();
}

init();
