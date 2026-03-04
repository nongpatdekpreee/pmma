-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: db:3306
-- Generation Time: Jan 18, 2026 at 05:40 PM
-- Server version: 11.3.2-MariaDB-1:11.3.2+maria~ubu2204
-- PHP Version: 8.3.26

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `TccStock`
--

-- --------------------------------------------------------

--
-- Table structure for table `devices`
--

CREATE TABLE `devices` (
  `Did` int(11) NOT NULL,
  `Asset_State` varchar(100) DEFAULT NULL,
  `serial` varchar(100) DEFAULT NULL,
  `CI_Name` varchar(100) DEFAULT NULL,
  `Asset_Number` varchar(100) DEFAULT NULL,
  `PR_No` varchar(100) DEFAULT NULL,
  `Vendor` varchar(100) DEFAULT NULL,
  `Project_purchase` varchar(255) DEFAULT NULL,
  `SLid` int(11) DEFAULT NULL,
  `PO_No` varchar(100) DEFAULT NULL,
  `Loan_Start` varchar(100) DEFAULT NULL,
  `Request_Date` varchar(100) DEFAULT NULL,
  `Refer_SOF` varchar(100) DEFAULT NULL,
  `Refer_Ticket` varchar(100) DEFAULT NULL,
  `Assigned_Service` varchar(100) DEFAULT NULL,
  `Reason` enum('New Installation','Not Assigned','Replacement','') DEFAULT NULL,
  `Dtypeid` int(11) DEFAULT NULL,
  `DeRoleid` int(11) DEFAULT NULL,
  `Project_code_purchase` varchar(100) DEFAULT NULL,
  `Waranty_start` date DEFAULT NULL,
  `Waranty_end` date DEFAULT NULL,
  `Received_date` timestamp NULL DEFAULT NULL,
  `Asset_Type` varchar(100) DEFAULT NULL,
  `Owner` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Triggers `devices`
--
DELIMITER $$
CREATE TRIGGER `trg_devices_insert` AFTER INSERT ON `devices` FOR EACH ROW BEGIN
  INSERT INTO Devices_History (
    action_type,
    changed_at,
    Did,
    Asset_State,
    serial,
    CI_Name,
    Asset_Number,
    PR_No,
    Vendor,
    Project_purchase,
    Sid,
    Location2,
    PO_No,
    Loan_Start,
    Request_Date,
    Refer_SOF,
    Refer_Ticket,
    Assigned_Service,
    Reason,
    Project_code_purchase,
    Waranty_start,
    Waranty_end,
    Received_date,
    Asset_Type,
    Owner,
    Dtypeid,
    DeRoleid,
    Description  -- เพิ่มบรรทัดนี้
  )
  VALUES (
    'INSERT',  -- หรือ 'UPDATE' สำหรับ UPDATE trigger
    NOW(),
    NEW.Did,  -- หรือ OLD.Did สำหรับ UPDATE
    NEW.Asset_State,
    NEW.serial,
    NEW.CI_Name,
    NEW.Asset_Number,
    NEW.PR_No,
    NEW.Vendor,
    NEW.Project_purchase,
    NEW.Sid,
    NEW.Location2,
    NEW.PO_No,
    NEW.Loan_Start,
    NEW.Request_Date,
    NEW.Refer_SOF,
    NEW.Refer_Ticket,
    NEW.Assigned_Service,
    NEW.Reason,
    NEW.Project_code_purchase,
    NEW.Waranty_start,
    NEW.Waranty_end,
    NEW.Received_date,
    NEW.Asset_Type,
    NEW.Owner,
    NEW.Dtypeid,
    NEW.DeRoleid,
    @status_change_description  -- เพิ่มบรรทัดนี้ (อ่านจาก session variable)
  );
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `trg_devices_update` AFTER UPDATE ON `devices` FOR EACH ROW BEGIN
  INSERT INTO Devices_History (
    action_type,
    changed_at,
    Did,
    Asset_State,
    serial,
    CI_Name,
    Asset_Number,
    PR_No,
    Vendor,
    Project_purchase,
    Sid,
    Location2,
    PO_No,
    Loan_Start,
    Request_Date,
    Refer_SOF,
    Refer_Ticket,
    Assigned_Service,
    Reason,
    Project_code_purchase,
    Waranty_start,
    Waranty_end,
    Received_date,
    Asset_Type,
    Owner,
    Dtypeid,
    DeRoleid,
    Description  -- เพิ่มบรรทัดนี้
  )
  VALUES (
    'UPDATE',
    NOW(),
    OLD.Did,
    OLD.Asset_State,
    OLD.serial,
    OLD.CI_Name,
    OLD.Asset_Number,
    OLD.PR_No,
    OLD.Vendor,
    OLD.Project_purchase,
    OLD.Sid,
    OLD.Location2,
    OLD.PO_No,
    OLD.Loan_Start,
    OLD.Request_Date,
    OLD.Refer_SOF,
    OLD.Refer_Ticket,
    OLD.Assigned_Service,
    OLD.Reason,
    OLD.Project_code_purchase,
    OLD.Waranty_start,
    OLD.Waranty_end,
    OLD.Received_date,
    OLD.Asset_Type,
    OLD.Owner,
    OLD.Dtypeid,
    OLD.DeRoleid,
    @status_change_description  -- เพิ่มบรรทัดนี้ (อ่านจาก session variable)
  );
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `devices_history`
--

CREATE TABLE `devices_history` (
  `log_id` int(11) NOT NULL,
  `action_type` varchar(10) DEFAULT NULL,
  `changed_at` datetime DEFAULT NULL,
  `Did` int(11) DEFAULT NULL,
  `Asset_State` varchar(50) DEFAULT NULL,
  `serial` varchar(100) DEFAULT NULL,
  `CI_Name` varchar(255) DEFAULT NULL,
  `Asset_Number` varchar(100) DEFAULT NULL,
  `PR_No` varchar(100) DEFAULT NULL,
  `Vendor` varchar(255) DEFAULT NULL,
  `Project_purchase` varchar(255) DEFAULT NULL,
  `Sid` int(11) DEFAULT NULL,
  `Location2` varchar(255) DEFAULT NULL,
  `PO_No` varchar(100) DEFAULT NULL,
  `Loan_Start` varchar(100) DEFAULT NULL,
  `Request_Date` varchar(100) DEFAULT NULL,
  `Refer_SOF` varchar(100) DEFAULT NULL,
  `Refer_Ticket` varchar(100) DEFAULT NULL,
  `Assigned_Service` varchar(255) DEFAULT NULL,
  `Reason` text DEFAULT NULL,
  `Dtypeid` int(11) DEFAULT NULL,
  `DeRoleid` int(11) DEFAULT NULL,
  `Project_code_purchase` varchar(100) DEFAULT NULL,
  `Waranty_start` date DEFAULT NULL,
  `Waranty_end` date DEFAULT NULL,
  `Received_date` date DEFAULT NULL,
  `Asset_Type` varchar(100) DEFAULT NULL,
  `Owner` varchar(255) DEFAULT NULL,
  `Description` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `device_role`
--

CREATE TABLE `device_role` (
  `DeRoleid` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `slug` varchar(100) NOT NULL,
  `color` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `device_role`
--

INSERT INTO `device_role` (`DeRoleid`, `name`, `slug`, `color`) VALUES
(1, 'server', 'server', '#749222');

-- --------------------------------------------------------

--
-- Table structure for table `device_type`
--

CREATE TABLE `device_type` (
  `Dtypeid` int(11) NOT NULL,
  `model` varchar(100) NOT NULL,
  `slug` varchar(100) NOT NULL,
  `u_height` float NOT NULL DEFAULT 1,
  `Mid` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `device_type`
--

INSERT INTO `device_type` (`Dtypeid`, `model`, `slug`, `u_height`, `Mid`) VALUES
(1, 'AIR-AP3802I-S-K9', 'air-ap3802i-s-k9', 1, 1);

-- --------------------------------------------------------

--
-- Table structure for table `location`
--

CREATE TABLE `location` (
  `lid` int(11) NOT NULL,
  `Location2` varchar(255) NOT NULL,
  `District` varchar(100) DEFAULT NULL,
  `Subdistrict` varchar(100) DEFAULT NULL,
  `Province` varchar(100) DEFAULT NULL,
  `Address_code` varchar(100) DEFAULT NULL,
  `Description` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `location`
--

INSERT INTO `location` (`lid`, `Location2`, `District`, `Subdistrict`, `Province`, `Address_code`, `Description`) VALUES
(1, 'Beer Thai', NULL, NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `manufacturer`
--

CREATE TABLE `manufacturer` (
  `Mid` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `slug` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `manufacturer`
--

INSERT INTO `manufacturer` (`Mid`, `name`, `slug`) VALUES
(1, 'Cisco', 'cisco');

-- --------------------------------------------------------

--
-- Table structure for table `netbox`
--

CREATE TABLE `netbox` (
  `Netid` int(11) NOT NULL,
  `Token` varchar(255) NOT NULL,
  `Server` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sites`
--

CREATE TABLE `sites` (
  `Sid` int(11) NOT NULL,
  `Name` varchar(100) NOT NULL,
  `Slug` varchar(100) DEFAULT NULL,
  `Status` enum('Active','Planned','Staging','Decommissioning') NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `sites`
--

INSERT INTO `sites` (`Sid`, `Name`, `Slug`, `Status`) VALUES
(1, 'Thai Beverage Public Company Limited', 'thai-beverage-public-company-limited', 'Active');

-- --------------------------------------------------------

--
-- Table structure for table `sites_location`
--

CREATE TABLE `sites_location` (
  `SLid` int(11) NOT NULL,
  `Sid` int(11) NOT NULL,
  `lid` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `sites_location`
--

INSERT INTO `sites_location` (`SLid`, `Sid`, `lid`) VALUES
(1, 1, 1);

-- --------------------------------------------------------

--
-- Table structure for table `user`
--

CREATE TABLE `user` (
  `User_id` int(11) NOT NULL,
  `Username` varchar(255) NOT NULL,
  `Password` varchar(255) NOT NULL,
  `Role` enum('User','Admin') NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `devices`
--
ALTER TABLE `devices`
  ADD PRIMARY KEY (`Did`),
  ADD KEY `frk1` (`Dtypeid`),
  ADD KEY `frk2` (`SLid`),
  ADD KEY `frk3` (`DeRoleid`);

--
-- Indexes for table `devices_history`
--
ALTER TABLE `devices_history`
  ADD PRIMARY KEY (`log_id`);

--
-- Indexes for table `device_role`
--
ALTER TABLE `device_role`
  ADD PRIMARY KEY (`DeRoleid`);

--
-- Indexes for table `device_type`
--
ALTER TABLE `device_type`
  ADD PRIMARY KEY (`Dtypeid`),
  ADD KEY `frk_type1` (`Mid`);

--
-- Indexes for table `location`
--
ALTER TABLE `location`
  ADD PRIMARY KEY (`lid`);

--
-- Indexes for table `manufacturer`
--
ALTER TABLE `manufacturer`
  ADD PRIMARY KEY (`Mid`);

--
-- Indexes for table `netbox`
--
ALTER TABLE `netbox`
  ADD PRIMARY KEY (`Netid`);

--
-- Indexes for table `sites`
--
ALTER TABLE `sites`
  ADD PRIMARY KEY (`Sid`);

--
-- Indexes for table `sites_location`
--
ALTER TABLE `sites_location`
  ADD PRIMARY KEY (`SLid`),
  ADD KEY `frk11` (`Sid`),
  ADD KEY `frk12` (`lid`);

--
-- Indexes for table `user`
--
ALTER TABLE `user`
  ADD PRIMARY KEY (`User_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `devices`
--
ALTER TABLE `devices`
  MODIFY `Did` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `devices_history`
--
ALTER TABLE `devices_history`
  MODIFY `log_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `device_role`
--
ALTER TABLE `device_role`
  MODIFY `DeRoleid` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `device_type`
--
ALTER TABLE `device_type`
  MODIFY `Dtypeid` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `location`
--
ALTER TABLE `location`
  MODIFY `lid` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `manufacturer`
--
ALTER TABLE `manufacturer`
  MODIFY `Mid` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `netbox`
--
ALTER TABLE `netbox`
  MODIFY `Netid` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `sites`
--
ALTER TABLE `sites`
  MODIFY `Sid` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `sites_location`
--
ALTER TABLE `sites_location`
  MODIFY `SLid` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `user`
--
ALTER TABLE `user`
  MODIFY `User_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `devices`
--
ALTER TABLE `devices`
  ADD CONSTRAINT `frk1` FOREIGN KEY (`Dtypeid`) REFERENCES `device_type` (`Dtypeid`),
  ADD CONSTRAINT `frk3` FOREIGN KEY (`DeRoleid`) REFERENCES `device_role` (`DeRoleid`),
  ADD CONSTRAINT `frk4` FOREIGN KEY (`SLid`) REFERENCES `sites_location` (`SLid`);

--
-- Constraints for table `device_type`
--
ALTER TABLE `device_type`
  ADD CONSTRAINT `frk_type1` FOREIGN KEY (`Mid`) REFERENCES `manufacturer` (`Mid`);

--
-- Constraints for table `sites_location`
--
ALTER TABLE `sites_location`
  ADD CONSTRAINT `frk11` FOREIGN KEY (`Sid`) REFERENCES `sites` (`Sid`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `frk12` FOREIGN KEY (`lid`) REFERENCES `location` (`lid`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
