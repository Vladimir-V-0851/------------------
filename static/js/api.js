export class ApiError extends Error {
    constructor(message, status, data) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.data = data;
    }
}

const fieldLabels = {
    username: "Логин",
    password: "Пароль",
    title: "Название",
    workout_date: "Дата",
    category: "Категория",
    duration_minutes: "Длительность",
    completed: "Статус",
    notes: "Заметки",
    name: "Название упражнения",
    weight_kg: "Вес",
    reps: "Повторения",
    sets: "Подходы",
};

export async function api(path, options = {}) {
    const settings = {
        credentials: "same-origin",
        ...options,
        headers: {
            Accept: "application/json",
            ...(options.headers || {}),
        },
    };

    if (options.body !== undefined && !(options.body instanceof FormData)) {
        settings.headers["Content-Type"] = "application/json";
        settings.body = JSON.stringify(options.body);
    }

    let response;
    try {
        response = await fetch(path, settings);
    } catch {
        throw new ApiError("Не удалось связаться с сервером. Проверьте подключение.", 0, null);
    }

    if (response.status === 204) {
        return null;
    }

    const contentType = response.headers.get("content-type") || "";
    let data = null;
    if (contentType.includes("application/json")) {
        try {
            data = await response.json();
        } catch {
            data = null;
        }
    } else {
        try {
            data = await response.text();
        } catch {
            data = null;
        }
    }

    if (!response.ok) {
        throw new ApiError(formatError(data, response.status), response.status, data);
    }

    return data;
}

function formatError(data, status) {
    if (data && Array.isArray(data.detail)) {
        return data.detail
            .map((item) => {
                const field = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : "";
                const label = fieldLabels[field] || field;
                const message = String(item.msg || "Некорректное значение").replace(/^Value error, /, "");
                return label ? `${label}: ${message}` : message;
            })
            .join("; ");
    }

    if (data && typeof data.detail === "string") {
        return data.detail;
    }

    if (status === 401) {
        return "Требуется авторизация";
    }
    if (status === 404) {
        return "Запись не найдена";
    }
    if (status === 422) {
        return "Проверьте правильность заполнения полей";
    }
    if (status >= 500) {
        return "Ошибка сервера. Попробуйте позже.";
    }
    return "Не удалось выполнить запрос";
}

export function errorMessage(error) {
    if (error instanceof ApiError) {
        return error.message;
    }
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return "Произошла неизвестная ошибка";
}

export function formatNumber(value, digits = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return "0";
    }
    return new Intl.NumberFormat("ru-RU", {
        maximumFractionDigits: digits,
        minimumFractionDigits: 0,
    }).format(number);
}

export function formatDate(value) {
    if (!value) {
        return "Дата не указана";
    }
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? new Date(`${value}T00:00:00`)
        : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }
    return new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
    }).format(date);
}

export function todayInputValue() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export async function redirectIfAuthenticated() {
    try {
        await api("/api/auth/me");
        window.location.replace("/");
    } catch (error) {
        if (error.status !== 401) {
            return;
        }
    }
}

export function redirectToLogin() {
    window.location.replace("/login");
}
