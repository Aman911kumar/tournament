import mongoose from "mongoose";
import { MONGODB_URI } from "../../env.js";

const connect_db = async () => {
    try {
        const connection = await mongoose.connect(MONGODB_URI)
        console.log(`\nDatabase connected successfully to :${connection.connection.host}`)
    } catch (error) {
        throw error
    }
}

export default connect_db