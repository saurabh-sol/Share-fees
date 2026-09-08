// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title UsdgRewardVault
/// @notice On-chain USDG reward claims for Accrued on Robinhood Chain.
/// @dev Swap scoring and LLM credits stay off-chain. A USDG redeem is not paid until
///      this contract stores the claim and transfers USDG. Duplicate redemption ids revert.
contract UsdgRewardVault {
    struct Claim {
        address recipient;
        uint256 amount;
        uint64 claimedAt;
        string redemptionId;
    }

    bytes32 private constant CLAIM_TYPEHASH =
        keccak256("Claim(string redemptionId,address recipient,uint256 amount,uint256 deadline)");
    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    address public immutable usdg;
    bytes32 private immutable _domainSeparator;
    address public owner;
    address public operator;
    uint256 public totalClaimed;

    mapping(bytes32 => Claim) private _claims;
    mapping(address => bytes32[]) private _claimsByRecipient;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event OperatorUpdated(address indexed operator);
    event VaultFunded(address indexed from, uint256 amount);
    event RewardClaimed(
        bytes32 indexed claimId,
        address indexed recipient,
        uint256 amount,
        string redemptionId
    );

    error Unauthorized();
    error ZeroAddress();
    error AlreadyClaimed();
    error InvalidAmount();
    error TransferFailed();
    error EmptyRedemptionId();
    error IndexOutOfBounds();
    error Expired();
    error InvalidSignature();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert Unauthorized();
        _;
    }

    constructor(address usdg_, address operator_) {
        if (usdg_ == address(0) || operator_ == address(0)) revert ZeroAddress();
        usdg = usdg_;
        owner = msg.sender;
        operator = operator_;
        _domainSeparator = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes("UsdgRewardVault")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
        emit OwnershipTransferred(address(0), msg.sender);
        emit OperatorUpdated(operator_);
    }

    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparator;
    }

    /// @notice Claim id is keccak256 of the desk redemption id (for example `rdm_…`).
    function claimIdOf(string calldata redemptionId) public pure returns (bytes32) {
        return keccak256(bytes(redemptionId));
    }

    /// @notice Recipient submits the on-chain claim with an operator EIP-712 signature.
    function claim(
        string calldata redemptionId,
        uint256 amount,
        uint256 deadline,
        bytes calldata signature
    ) external {
        if (block.timestamp > deadline) revert Expired();
        bytes32 digest = _claimDigest(redemptionId, msg.sender, amount, deadline);
        if (_recoverSigner(digest, signature) != operator) revert Unauthorized();
        _settle(redemptionId, msg.sender, amount);
    }

    /// @notice Operator pays a claim when the user does not submit the wallet transaction.
    function payClaim(string calldata redemptionId, address recipient, uint256 amount)
        external
        onlyOperator
    {
        _settle(redemptionId, recipient, amount);
    }

    function getClaim(bytes32 claimId)
        external
        view
        returns (address recipient, uint256 amount, uint64 claimedAt, string memory redemptionId)
    {
        Claim storage row = _claims[claimId];
        return (row.recipient, row.amount, row.claimedAt, row.redemptionId);
    }

    function claimed(bytes32 claimId) external view returns (bool) {
        return _claims[claimId].claimedAt != 0;
    }

    function recipientClaimCount(address recipient) external view returns (uint256) {
        return _claimsByRecipient[recipient].length;
    }

    function recipientClaimAt(address recipient, uint256 index) external view returns (bytes32) {
        if (index >= _claimsByRecipient[recipient].length) revert IndexOutOfBounds();
        return _claimsByRecipient[recipient][index];
    }

    function usdgBalance() external view returns (uint256) {
        return _balanceOf(usdg, address(this));
    }

    /// @notice Pull USDG from the caller after they `approve` this vault.
    function fund(uint256 amount) external {
        if (amount == 0) revert InvalidAmount();
        _safeTransferFrom(usdg, msg.sender, address(this), amount);
        emit VaultFunded(msg.sender, amount);
    }

    function setOperator(address newOperator) external onlyOwner {
        if (newOperator == address(0)) revert ZeroAddress();
        operator = newOperator;
        emit OperatorUpdated(newOperator);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Rescue USDG or any other ERC-20 sent here by mistake.
    function recover(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        _safeTransfer(token, to, amount);
    }

    function _settle(string calldata redemptionId, address recipient, uint256 amount) private {
        if (bytes(redemptionId).length == 0) revert EmptyRedemptionId();
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();

        bytes32 claimId = claimIdOf(redemptionId);
        if (_claims[claimId].claimedAt != 0) revert AlreadyClaimed();

        _claims[claimId] = Claim({
            recipient: recipient,
            amount: amount,
            claimedAt: uint64(block.timestamp),
            redemptionId: redemptionId
        });
        _claimsByRecipient[recipient].push(claimId);
        totalClaimed += amount;

        _safeTransfer(usdg, recipient, amount);
        emit RewardClaimed(claimId, recipient, amount, redemptionId);
    }

    function _claimDigest(
        string calldata redemptionId,
        address recipient,
        uint256 amount,
        uint256 deadline
    ) private view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                CLAIM_TYPEHASH,
                keccak256(bytes(redemptionId)),
                recipient,
                amount,
                deadline
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", _domainSeparator, structHash));
    }

    function _recoverSigner(bytes32 digest, bytes calldata signature) private pure returns (address) {
        if (signature.length != 65) revert InvalidSignature();
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly ("memory-safe") {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (v < 27) {
            v += 27;
        }
        address recovered = ecrecover(digest, v, r, s);
        if (recovered == address(0)) revert InvalidSignature();
        return recovered;
    }

    function _balanceOf(address token, address account) private view returns (uint256) {
        (bool ok, bytes memory data) = token.staticcall(abi.encodeWithSelector(0x70a08231, account));
        if (!ok || data.length < 32) revert TransferFailed();
        return abi.decode(data, (uint256));
    }

    function _safeTransfer(address token, address to, uint256 amount) private {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) private {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
