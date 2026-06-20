// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// 最小只读接口：MFTReward 只需要 Crowdfunding 的几个 public getter。
// Crowdfunding 的 contributions 是 public mapping，会自动生成同名 getter。
interface ICrowdfunding {
    function contributions(address) external view returns (uint256);
    function goal() external view returns (uint256);
    function deadline() external view returns (uint256);
    function totalRaised() external view returns (uint256);
}

contract MFTReward is ERC20 {
    ICrowdfunding public immutable crowdfunding;

    // 1 wei 捐款 = 1000 个 MFT 最小单位（即 1 ETH 捐款 = 1000 MFT）
    uint256 public constant REWARD_RATE = 1000;

    // 防双花：记录谁已领取
    mapping(address => bool) public claimed;

    event RewardClaimed(address indexed user, uint256 amount);

    constructor(address _crowdfunding) ERC20("MFT", "MFT") {
        crowdfunding = ICrowdfunding(_crowdfunding);
    }

    // 众筹成功（达标 + 到期）后，捐款人按捐款额领取 MFT 奖励。
    // _mint(msg.sender, ...) 同时完成铸造与到账，故 mint 与 claim 合并为这一步。
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

        // Checks-Effects：先标记已领取，防重入
        claimed[msg.sender] = true;

        uint256 reward = contribution * REWARD_RATE;
        _mint(msg.sender, reward);

        emit RewardClaimed(msg.sender, reward);
    }
}
