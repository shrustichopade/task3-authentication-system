async function loadDashboard() {
    const message = document.getElementById("dashboardMessage");
    const errorBox = document.getElementById("dashboardError");

    try {
        const response = await fetch("/api/auth/me", {
            credentials: "same-origin"
        });

        const result = await response.json();

        if (!response.ok) {
            window.location.replace("/login.html");
            return;
        }

        document.getElementById("username").textContent =
            result.user.username;

        document.getElementById("email").textContent =
            result.user.email;

        document.getElementById("userId").textContent =
            result.user.id;

        document.getElementById("userDetails").hidden = false;

        message.textContent =
            "You are logged in. Your account details are shown below.";

    } catch (error) {
        errorBox.textContent =
            "Could not connect to the server. Please refresh the page.";
    }
}

// Logout button.
document.getElementById("logoutButton").addEventListener(
    "click",
    async () => {
        try {
            await fetch("/api/auth/logout", {
                method: "POST",
                credentials: "same-origin"
            });
        } finally {
            window.location.replace("/login.html");
        }
    }
);

loadDashboard();