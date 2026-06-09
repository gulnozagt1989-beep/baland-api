export const verifyPromo = (req, res) => {
  try {
    const { promo } = req.body;
    
    if (promo && promo.trim().toUpperCase() === "BALAND10") {
      return res.status(200).json({ success: true, discount: 10000000 });
    }

    return res.status(200).json({ success: false, error: "❌ Promokod noto‘g‘ri kiritildi" });
  } catch (error) {
    return res.status(400).json({ success: false, error: "Bad Request" });
  }
};
