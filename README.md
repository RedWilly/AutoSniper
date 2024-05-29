## AutoSniper - Be Safe from Honeypot

This isn't your grandma's trading bot. AutoSniper is built for speed and efficiency, designed to get you into the hottest new tokens on [Base Network](https://chainlist.org/chain/8453) before anyone else even blinks. 

**🛡️ 70%+ Honeypot Protection:**

We've built in multiple layers of analysis to detect and avoid honeypot scams.  While no system is perfect, AutoSniper significantly reduces your risk compared to going in blind.

**🚀 What it does:**

* **Constantly monitors** the Base blockchain for newly created trading pairs.
* **Analyzes in milliseconds:**
    * Checks for common honeypot patterns (low liquidity, suspicious ownership).
    * Identifies potential trading opportunities with a good risk/reward profile.
* **Executes lightning-fast trades** to secure your position (but only if it looks safe!).

**⚠️ Disclaimer:**

This bot is provided as-is, for educational purposes only. Using trading bots involves significant financial risk.  Do your own research, and never invest more than you can afford to lose.

## Getting Started

1. **Clone the repo:**

   ```bash
   git clone https://github.com/RedWilly/AutoSniper.git
   ```

2. **Install dependencies:**

   ```bash
   cd AutoSniper
   npm install
   ```

3. **Configure:**

   * **Open `index.js`** in your favorite code editor (i won't judge... much).
   * **Update:**
     * `wss://base.blockpi.network/v1/ws/1292.8279`: Replace with your preferred Base Network websocket provider.
     * `0x{privatekey}`:  **IMPORTANT!** Replace with your wallet's private key (keep this **SUPER SECRET!**).
     * `GAS_PRICE_GWEI`: Adjust gas price for optimal speed vs. cost.
     * `ETH_AMOUNT_TO_SEND`: How much ETH you're willing to risk per trade.

4. **Start Sniping!**

   ```bash
   node index.js
   ```

## Features

* **Base Network Optimized:** Specifically designed for the Base blockchain.
* **Fast & Efficient:**  Uses `ethers.js` and a WebSocket connection for real-time market data.
* **Customizable:**  Configure gas, trade amount, and more to fit your risk appetite.

## Contributing

Pull requests are welcome! Let's make AutoSniper the most feared (or loved?) bot on Base.

##  🙏 Shoutout 

If you find this bot useful or just want to show some love, my ETH/Base address is `0x5A79eC71355b5fBebA59828D4307a9a796D19DA4`. Happy sniping

## License

This project is licensed under the MIT License. 
