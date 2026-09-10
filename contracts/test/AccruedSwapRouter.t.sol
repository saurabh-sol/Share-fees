// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../AccruedSwapRouter.sol";

contract AccruedSwapRouterTest is Test {
    AccruedSwapRouter router;
    address constant SWAP_ROUTER_02 = 0xcaf681a66d020601342297493863e78c959e5cb2;
    address constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;

    function setUp() public {
        vm.createSelectFork("https://rpc.mainnet.chain.robinhood.com");
        router = new AccruedSwapRouter(SWAP_ROUTER_02, WETH);
    }

    function test_constructorStoresImmutableAddresses() public view {
        assertEq(router.swapRouter02(), SWAP_ROUTER_02);
        assertEq(router.weth(), WETH);
    }

    function test_revertZeroAmount() public {
        AccruedSwapRouter.ExactInputSingleParams memory params = AccruedSwapRouter
            .ExactInputSingleParams({
            tokenIn: address(0),
            tokenOut: WETH,
            fee: 3000,
            recipient: address(this),
            amountIn: 0,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0,
            unwrapWeth: false
        });

        vm.expectRevert(AccruedSwapRouter.InvalidAmount.selector);
        router.swapV3ExactInputSingle(params);
    }
}
