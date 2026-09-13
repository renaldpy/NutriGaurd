import { analyzeCart } from "./analyzeCart.js";

const textResult = await analyzeCart({
  domText: "Cart: Jif Peanut Butter x1, Oat Milk x2, Salmon Fillet x1, White Bread x1",
  allergens: ["peanuts", "shellfish"],
  targetVitamins: ["Vitamin D"],
});

console.log("=== DOM text path ===");
console.log(JSON.stringify(textResult, null, 2));
