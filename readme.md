xToken Management (“Mgmt”) is the first “staking module” we’ll be releasing under the XTK Multi-Staking umbrella. Mgmt sources rewards for stakers via two channels:
Revenue: this is the management fees charged on xAsset funds. The RevenueController contract claims fees from xAssets, exchanges fee tokens for XTK via 1inch (off-chain api data will need to be passed to permissioned function `claimAndSwap`), and then transfers XTK to Mgmt module
Rewards: this is the XTK inflationary incentive paid out linearly to stakers via the RewardsController. Via team/community consensus and eventually formal governance, XTK inflation is set with an amount and a duration (e.g., 40m XTK for 1 year). At any time, a publicly callable function can release the proportional amount of XTK available since the last call. This function transfers the XTK from the RewardsController to the staking module.

One foreseaable potential complication is that, due to the proxy framework we’re using, our main Team Multisig is only able to execute transactions on the proxy contract. If we set the Team Multisig as owner on the implementation for a contract where the proxy is controlled by the Team Multisig. For this reason, we will have to figure out how to configure admin functions that we want controllable by the team multisig (eventually team multisig will be transitioned to more formal governance, which will face the same issue).

## TODO

- we'll need to upgrade xAsset funds to change `withdrawFees` permissions from `onlyOwner` to `onlyRevenueController` or something similar
- create a new "Governance" contract that controls operations on the staking module. This should be controlled by team multisig (need to figure out these details)

## Deployed Contracts Addresses

- ProxyAdmin: 0x54FF0Bf514134A24D2795c554952E0ce1F47aC79
- XTKManagementStakingModule: 0x314022E24ceD941781DC295682634B37Bd0d9cFc
- RevenueController: 0xbc36d8121B82C0B8E7EF0374ea19fC073335CC3C
- RewardController: 0x95B6d1848A9940a42F22054084c0590A9997C653
