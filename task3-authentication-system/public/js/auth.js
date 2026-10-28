async function submitAuthForm(
    form,
    endpoint,
    payload,
    successRedirect
) {
    const message = document.getElementById("formMessage");
    const button = form.querySelector('button[type="submit"]');

    message.textContent = "";
    message.className = "message";

    button.disabled = true;
    button.textContent = "Please wait…";

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "same-origin",
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.message || "Something went wrong."
            );
        }

        message.textContent = result.message;
        message.className = "message success";

        if (successRedirect) {
            setTimeout(() => {
                window.location.href = successRedirect;
            }, 700);
        }

    } catch (error) {
        message.textContent =
            error.message || "Could not connect to the server.";

    } finally {
        button.disabled = false;

        button.textContent = endpoint.endsWith("/register")
            ? "Register"
            : "Login";
    }
}

// Registration form.
const registerForm = document.getElementById("registerForm");

if (registerForm) {
    registerForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const data = new FormData(registerForm);

        submitAuthForm(
            registerForm,
            "/api/auth/register",
            {
                email: data.get("email"),
                username: data.get("username"),
                password: data.get("password")
            },
            "/login.html"
        );
    });
}

// Login form.
const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const data = new FormData(loginForm);

        submitAuthForm(
            loginForm,
            "/api/auth/login",
            {
                identity: data.get("identity"),
                password: data.get("password")
            },
            "/dashboard.html"
        );
    });
}