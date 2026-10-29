import {
    api,
    errorMessage,
    redirectIfAuthenticated,
} from "./api.js";

const form = document.querySelector("#register-form");
const usernameInput = document.querySelector("#username");
const passwordInput = document.querySelector("#password");
const passwordConfirmInput = document.querySelector("#password-confirm");
const errorBox = document.querySelector("#form-error");
const submitButton = document.querySelector("#register-submit");

function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
}

function hideError() {
    errorBox.textContent = "";
    errorBox.hidden = true;
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideError();

    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    if (passwordInput.value !== passwordConfirmInput.value) {
        showError("Пароли не совпадают");
        passwordConfirmInput.focus();
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Создаём аккаунт...";

    try {
        await api("/api/auth/register", {
            method: "POST",
            body: {
                username: usernameInput.value.trim(),
                password: passwordInput.value,
            },
        });
        window.location.replace("/");
    } catch (error) {
        showError(errorMessage(error));
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Зарегистрироваться";
    }
});

redirectIfAuthenticated();
