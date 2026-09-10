// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AccruedSwapRouter
/// @notice Routes Robinhood Chain swaps through Uniswap V3 SwapRouter02 and emits AccruedSwap for analytics.
/// @dev One AccruedSwap event per user trade; internal routing hops are not emitted separately.
contract AccruedSwapRouter {
    address public immutable swapRouter02;
    address public immutable weth;

    /// @dev Uniswap periphery convention — recipient = address(2) means the SwapRouter02 contract.
    address private constant ADDRESS_THIS = address(0x0000000000000000000000000000000000000002);

    event AccruedSwap(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address recipient
    );

    error ZeroAddress();
    error InvalidAmount();
    error EthMismatch();
    error TransferFailed();

    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
        bool unwrapWeth;
    }

    struct ExactInputParams {
        bytes path;
        address tokenIn;
        address tokenOut;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        bool unwrapWeth;
    }

    constructor(address swapRouter02_, address weth_) {
        if (swapRouter02_ == address(0) || weth_ == address(0)) revert ZeroAddress();
        swapRouter02 = swapRouter02_;
        weth = weth_;
    }

    /// @notice Single-hop V3 swap attributed to Accrued.
    function swapV3ExactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut)
    {
        if (params.amountIn == 0) revert InvalidAmount();
        _pullTokenIn(params.tokenIn, params.amountIn);

        if (params.unwrapWeth) {
            amountOut = _multicallSingleWithUnwrap(params);
        } else {
            amountOut = ISwapRouter02(swapRouter02).exactInputSingle{value: msg.value}(
                ISwapRouter02.ExactInputSingleParams({
                    tokenIn: params.tokenIn,
                    tokenOut: params.tokenOut,
                    fee: params.fee,
                    recipient: params.recipient,
                    amountIn: params.amountIn,
                    amountOutMinimum: params.amountOutMinimum,
                    sqrtPriceLimitX96: params.sqrtPriceLimitX96
                })
            );
        }

        emit AccruedSwap(
            msg.sender,
            params.tokenIn,
            params.tokenOut,
            params.amountIn,
            amountOut,
            params.recipient
        );
    }

    /// @notice Multi-hop V3 swap attributed to Accrued.
    function swapV3ExactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut) {
        if (params.amountIn == 0) revert InvalidAmount();
        _pullTokenIn(params.tokenIn, params.amountIn);

        if (params.unwrapWeth) {
            amountOut = _multicallPathWithUnwrap(params);
        } else {
            amountOut = ISwapRouter02(swapRouter02).exactInput{value: msg.value}(
                ISwapRouter02.ExactInputParams({
                    path: params.path,
                    recipient: params.recipient,
                    amountIn: params.amountIn,
                    amountOutMinimum: params.amountOutMinimum
                })
            );
        }

        emit AccruedSwap(
            msg.sender,
            params.tokenIn,
            params.tokenOut,
            params.amountIn,
            amountOut,
            params.recipient
        );
    }

    receive() external payable {}

    function _pullTokenIn(address tokenIn, uint256 amountIn) internal {
        if (tokenIn == address(0)) {
            if (msg.value != amountIn) revert EthMismatch();
            return;
        }
        if (msg.value != 0) revert EthMismatch();
        if (!_safeTransferFrom(tokenIn, msg.sender, address(this), amountIn)) revert TransferFailed();
        if (!IERC20(tokenIn).approve(swapRouter02, amountIn)) revert TransferFailed();
    }

    function _multicallSingleWithUnwrap(ExactInputSingleParams calldata params)
        internal
        returns (uint256 amountOut)
    {
        bytes[] memory calls = new bytes[](2);
        calls[0] = abi.encodeWithSelector(
            ISwapRouter02.exactInputSingle.selector,
            ISwapRouter02.ExactInputSingleParams({
                tokenIn: params.tokenIn,
                tokenOut: params.tokenOut,
                fee: params.fee,
                recipient: ADDRESS_THIS,
                amountIn: params.amountIn,
                amountOutMinimum: params.amountOutMinimum,
                sqrtPriceLimitX96: params.sqrtPriceLimitX96
            })
        );
        calls[1] = abi.encodeWithSelector(
            ISwapRouter02.unwrapWETH9.selector,
            params.amountOutMinimum,
            params.recipient
        );

        bytes[] memory results = ISwapRouter02(swapRouter02).multicall{value: msg.value}(
            block.timestamp + 20 minutes,
            calls
        );
        amountOut = abi.decode(results[0], (uint256));
    }

    function _multicallPathWithUnwrap(ExactInputParams calldata params) internal returns (uint256 amountOut) {
        bytes[] memory calls = new bytes[](2);
        calls[0] = abi.encodeWithSelector(
            ISwapRouter02.exactInput.selector,
            ISwapRouter02.ExactInputParams({
                path: params.path,
                recipient: ADDRESS_THIS,
                amountIn: params.amountIn,
                amountOutMinimum: params.amountOutMinimum
            })
        );
        calls[1] = abi.encodeWithSelector(
            ISwapRouter02.unwrapWETH9.selector,
            params.amountOutMinimum,
            params.recipient
        );

        bytes[] memory results = ISwapRouter02(swapRouter02).multicall{value: msg.value}(
            block.timestamp + 20 minutes,
            calls
        );
        amountOut = abi.decode(results[0], (uint256));
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal returns (bool) {
        return IERC20(token).transferFrom(from, to, amount);
    }
}

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface ISwapRouter02 {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut);

    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut);

    function multicall(uint256 deadline, bytes[] calldata data)
        external
        payable
        returns (bytes[] memory results);

    function unwrapWETH9(uint256 amountMinimum, address recipient) external payable;
}
