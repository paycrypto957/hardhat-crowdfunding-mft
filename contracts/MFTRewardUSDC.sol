// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// 只读接口：MFTRewardUSDC 只需要 CrowdfundingUSDC 的几个 public getter
interface ICrowdfundingUSDC {
    function contributions(address) external view returns (uint256);
    function goal() external view returns (uint256);
    function deadline() external view returns (uint256);
    function totalRaised() external view returns (uint256);
}

// USDC 版奖励代币：众筹成功后，按捐款额（USDC）铸造 MFT，比例 1 USDC = 10 MFT。
contract MFTRewardUSDC is ERC20 {
    ICrowdfundingUSDC public immutable crowdfunding;

    // 比例 1 USDC → 10 MFT。USDC 6 decimals、MFT 18 decimals，
    // 换算系数 = 10 × 10^(18-6) = 10^13。
    uint256 public constant REWARD_RATE = 10 ** 13;

    mapping(address => bool) public claimed;

    event RewardClaimed(address indexed user, uint256 amount);

    constructor(address _crowdfunding) ERC20("MFT", "MFT") {
        crowdfunding = ICrowdfundingUSDC(_crowdfunding);
    }

    // 众筹成功（达标 + 到期）后，捐款人按捐款额领取 MFT 奖励。
    function claimReward() external {
        require(
            block.timestamp >= crowdfunding.deadline(),
            "Campaign still active"
        );
        require(
            crowdfunding.totalRaised() >= crowdfunding.goal(),
            "Goal not reached"
        );
        require(!claimed[msg.sender], "Already claimed");

        uint256 contribution = crowdfunding.contributions(msg.sender);
        require(contribution > 0, "No contribution to reward");

        claimed[msg.sender] = true; // CEI：先标记已领取
        uint256 reward = contribution * REWARD_RATE;
        _mint(msg.sender, reward);

        emit RewardClaimed(msg.sender, reward);
    }
}
