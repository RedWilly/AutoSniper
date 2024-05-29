// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IERC20.sol";

contract HoneypotFighter {
    address private constant UNISWAP_ROUTER_ADDRESS = 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24;
    IUniswapV2Router02 private immutable uniswapRouter; 

    constructor() {
        uniswapRouter = IUniswapV2Router02(UNISWAP_ROUTER_ADDRESS);
    }

    receive() external payable {}

    function fightHoneypot(address token, uint256 slippagePercentage, uint256 deadline) 
        external 
        payable 
    {
        require(msg.value > 0, "Ether required");
        require(slippagePercentage <= 50, "Slippage too high");

        address[] memory path = new address[](2);
        path[0] = uniswapRouter.WETH();
        path[1] = token;

        // Initial Buy
        uint256[] memory initialAmountsOut = uniswapRouter.getAmountsOut(msg.value / 2, path); // Use half the ETH
        uint256 initialAmountOutMin = initialAmountsOut[1] * (100 - slippagePercentage) / 100;
        uniswapRouter.swapExactETHForTokensSupportingFeeOnTransferTokens{value: msg.value / 2}(
            initialAmountOutMin,
            path,
            address(this),
            deadline
        );

        // Attempt to Sell (Honeypot Detection)
        uint256 tokenBalance = IERC20(token).balanceOf(address(this));
        IERC20(token).approve(UNISWAP_ROUTER_ADDRESS, tokenBalance);

        path[0] = token;
        path[1] = uniswapRouter.WETH();

        try uniswapRouter.swapExactTokensForETHSupportingFeeOnTransferTokens(
            tokenBalance,
            0, // Set min ETH out to 0 to allow any amount (honeypot risk)
            path,
            address(this),
            deadline
        ) { 
            // Successful Sold it and - Likely not a honeypot (but still not guaranteed)

            // Buy again with remaining ETH
            uint256 ethBalance = address(this).balance;
            path[0] = uniswapRouter.WETH();
            path[1] = token;
            uint256[] memory finalAmountsOut = uniswapRouter.getAmountsOut(ethBalance, path);
            uint256 finalAmountOutMin = finalAmountsOut[1] * (100 - slippagePercentage) / 100;
            uniswapRouter.swapExactETHForTokensSupportingFeeOnTransferTokens{value: ethBalance}(
                finalAmountOutMin,
                path,
                msg.sender,
                deadline
            );
        } catch {
            revert("Potential Honeypot Detected! Sell failed."); 
        }
    }
}
