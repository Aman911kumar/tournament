import { RAPIDAPI_KEY } from "../../env.js";
const BASE_URL = "https://id-game-checker.p.rapidapi.com";

export const normalizeGame = (game) => {
    if (!game) return null;

    const g = game.trim().toLowerCase().replace(/\s+/g, "");

    const gameMap = {
        // Free Fire
        freefire: "freefire",
        ff: "freefire",

        // BGMI
        bgmi: "bgmi",
        pubg: "bgmi",
        pubgmobile: "bgmi",

        // Call of Duty
        cod: "cod",
        codm: "cod",
        callofduty: "cod",

        // Valorant
        valorant: "valorant",
        valoran: "valorant", // typo handling
    };

    return gameMap[g] || null;
};

export const verifyGameId = async (game, gameId) => {
    if (!gameId) {
        throw new Error("Game ID is required");
    }

    const normalizedGame = normalizeGame(game);

    if (!normalizedGame) {
        throw new Error("Unsupported game");
    }

    const endpoints = {
        freefire: `ff-global/${gameId}`,
    };

    const endpoint = endpoints[normalizedGame];
    // console.log(BASE_URL,endpoint)

    try {
        const response = await fetch(`${BASE_URL}/${endpoint}`, {
            method: "GET",
            headers: {
                "x-rapidapi-key": process.env.RAPIDAPI_KEY,
                "x-rapidapi-host": "id-game-checker.p.rapidapi.com",
            },
        });

        const data = await response.json();
        // console.log(data)

        // 🔥 Correct validation
        if (!response.ok || data.error || !data.data?.username) {
            return {
                valid: false,
                message: "Invalid Game ID",
            };
        }

        return {
            valid: true,
            game: normalizedGame,
            data: {
                id: data.data.id,
                username: data.data.username,
            },
        };

    } catch (error) {
        console.error("Game verification error:", error.message);

        return {
            valid: false,
            message: error.message || "Verification failed",
        };
    }
};