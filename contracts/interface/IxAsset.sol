pragma solidity ^0.8.0;

interface IxAsset {
    function withdrawFees() external;

    function transferOwnership(address newOwner) external;
}
