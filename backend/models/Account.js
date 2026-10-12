import mongoose from "mongoose";

const AccountSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  balance: {
    type: Number,
    required: true,
    default: 0,
  },
});

// The fix is to check if the model is already compiled before defining it.
const Account = mongoose.models.Account || mongoose.model("Account", AccountSchema);

export default Account;