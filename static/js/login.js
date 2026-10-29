import {
    api,
    errorMessage,
    redirectIfAuthenticated,
} from "./api.js";

const form = document.querySelector("#login-form");
const usernameInput = document.querySelector("#username");
const passwordInput = document.querySelector("#password");
const errorBox = document.querySelector("#form-error");
const submitButton = document.querySelector("#login-submit");

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

    submitButton.disabled = true;
    submitButton.textContent = "Входим...";

    try {
        await api("/api/auth/login", {
            method: "POST",
            body: {
                username: usernameInput.value.trim(),
                password: passwordInput.value,
            },
        });
        window.location.replace("/");
    } catch (error) {
        showError(errorMessage(error));
        passwordInput.select();
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Войти";
    }
});

redirectIfAuthenticated();
