// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// 用 USDC（ERC20）捐款的众筹合约。参照 Crowdfunding.sol，把 ETH 换成 USDC：
// fund() 不再 payable，改为接收 amount 并调 usdc.transferFrom（调用者需先 approve）。
contract CrowdfundingUSDC {
    IERC20 public immutable usdc;
    address public immutable owner;
    uint256 public immutable goal; // 目标金额，USDC 最小单位（6 decimals）
    uint256 public immutable deadline; // 截止时间戳（秒）
    uint256 public totalRaised;
    bool public withdrawn;

    mapping(address => uint256) public contributions;

    // 参与人数（每个地址只计一次；hasFunded 持久保留，退款后也不重置）
    uint256 public backersCount;
    mapping(address => bool) public hasFunded;

    event Funded(address indexed funder, uint256 amount, uint256 totalRaised);
    event Withdrawn(address indexed owner, uint256 amount);
    event Refunded(address indexed funder, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can call this");
        _;
    }

    modifier beforeDeadline() {
        require(block.timestamp < deadline, "Campaign has ended");
        _;
    }

    modifier afterDeadline() {
        require(block.timestamp >= deadline, "Campaign is still active");
        _;
    }

    constructor(address _usdc, uint256 _goal, uint256 _durationInSeconds) {
        require(_goal > 0, "Goal must be greater than zero");
        require(_durationInSeconds > 0, "Duration must be greater than zero");

        usdc = IERC20(_usdc);
        owner = msg.sender; // USDC 版无需 payable（不转 ETH）
        goal = _goal;
        deadline = block.timestamp + _durationInSeconds;
    }

    // 捐款：调用者需先 usdc.approve(本合约地址, amount)
    function fund(uint256 amount) external beforeDeadline {
        require(amount > 0, "Must fund positive amount");

        // Checks-Effects：先记账再转账，防恶意代币回调重入
        // 严格统计参与人数：每个地址只计一次（hasFunded 持久保留，退款后也不重置）
        if (!hasFunded[msg.sender]) {
            hasFunded[msg.sender] = true;
            backersCount += 1;
        }
        contributions[msg.sender] += amount;
        totalRaised += amount;

        emit Funded(msg.sender, amount, totalRaised);

        require(usdc.transferFrom(msg.sender, address(this), amount), "Transfer failed");
    }

    // 创建者提款：到期 + 达标，且只能提一次
    function withdraw() external onlyOwner afterDeadline {
        require(totalRaised >= goal, "Goal not reached");
        require(!withdrawn, "Already withdrawn");

        withdrawn = true;
        uint256 amount = usdc.balanceOf(address(this));

        emit Withdrawn(owner, amount);

        require(usdc.transfer(owner, amount), "Transfer failed");
    }

    // 捐款人退款：到期但未达标时，按本人捐款额退回
    function claimRefund() external afterDeadline {
        require(totalRaised < goal, "Goal reached, no refund");

        uint256 contributed = contributions[msg.sender];
        require(contributed > 0, "Nothing to refund");

        contributions[msg.sender] = 0; // CEI：先清零再转账

        emit Refunded(msg.sender, contributed);

        require(usdc.transfer(msg.sender, contributed), "Refund failed");
    }
}
