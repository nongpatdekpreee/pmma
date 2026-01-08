-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: db:3306
-- Generation Time: Dec 24, 2025 at 09:46 AM
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
-- Table structure for table `Devices`
--

CREATE TABLE `Devices` (
  `Did` int(11) NOT NULL,
  `Asset_State` varchar(100) DEFAULT NULL,
  `serial` varchar(100) DEFAULT NULL,
  `CI_Name` varchar(100) DEFAULT NULL,
  `Asset_Number` varchar(100) DEFAULT NULL,
  `PR_No` varchar(100) DEFAULT NULL,
  `Vendor` varchar(100) DEFAULT NULL,
  `Project` varchar(255) DEFAULT NULL,
  `Sid` int(11) DEFAULT NULL,
  `Location2` varchar(100) DEFAULT NULL,
  `PO_No` varchar(100) DEFAULT NULL,
  `Loan_Start` varchar(100) DEFAULT NULL,
  `Request_Date` varchar(100) DEFAULT NULL,
  `Refer_SOF` varchar(100) DEFAULT NULL,
  `Refer_Ticket` varchar(100) DEFAULT NULL,
  `Assigned_Service` varchar(100) DEFAULT NULL,
  `Reason` enum('New Installation','Not Assigned','Replacement','') DEFAULT NULL,
  `warranty` date DEFAULT NULL,
  `Dtypeid` int(11) DEFAULT NULL,
  `DeRoleid` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `Device_Role`
--

CREATE TABLE `Device_Role` (
  `DeRoleid` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `slug` varchar(100) NOT NULL,
  `color` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `Device_Type`
--

CREATE TABLE `Device_Type` (
  `Dtypeid` int(11) NOT NULL,
  `model` varchar(100) NOT NULL,
  `slug` varchar(100) NOT NULL,
  `u_height` float NOT NULL DEFAULT 1,
  `Mid` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `Manufacturer`
--

CREATE TABLE `Manufacturer` (
  `Mid` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `slug` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `Sites`
--

CREATE TABLE `Sites` (
  `Sid` int(11) NOT NULL,
  `Name` varchar(100) NOT NULL,
  `Slug` varchar(100) DEFAULT NULL,
  `Status` enum('Active','Planned','Staging','Decommissioning') NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `Device_History`
--

CREATE TABLE `Device_History` (
  `Historyid` int(11) NOT NULL,
  `Did` int(11) NOT NULL,
  `Action` enum('INSERT','UPDATE','ASSET_STATE_CHANGE') NOT NULL,
  `Old_Value` varchar(100) DEFAULT NULL,
  `New_Value` varchar(100) DEFAULT NULL,
  `Changed_Fields` text DEFAULT NULL,
  `Created_At` timestamp NOT NULL DEFAULT current_timestamp(),
  `User` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `Devices`
--
ALTER TABLE `Devices`
  ADD PRIMARY KEY (`Did`),
  ADD KEY `frk1` (`Dtypeid`),
  ADD KEY `frk2` (`Sid`),
  ADD KEY `frk3` (`DeRoleid`);

--
-- Indexes for table `Device_Role`
--
ALTER TABLE `Device_Role`
  ADD PRIMARY KEY (`DeRoleid`);

--
-- Indexes for table `Device_Type`
--
ALTER TABLE `Device_Type`
  ADD PRIMARY KEY (`Dtypeid`),
  ADD KEY `frk_type1` (`Mid`);

--
-- Indexes for table `Manufacturer`
--
ALTER TABLE `Manufacturer`
  ADD PRIMARY KEY (`Mid`);

--
-- Indexes for table `Sites`
--
ALTER TABLE `Sites`
  ADD PRIMARY KEY (`Sid`);

--
-- Indexes for table `Device_History`
--
ALTER TABLE `Device_History`
  ADD PRIMARY KEY (`Historyid`),
  ADD KEY `frk_history1` (`Did`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `Devices`
--
ALTER TABLE `Devices`
  MODIFY `Did` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `Device_Role`
--
ALTER TABLE `Device_Role`
  MODIFY `DeRoleid` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `Device_Type`
--
ALTER TABLE `Device_Type`
  MODIFY `Dtypeid` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `Manufacturer`
--
ALTER TABLE `Manufacturer`
  MODIFY `Mid` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `Sites`
--
ALTER TABLE `Sites`
  MODIFY `Sid` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `Device_History`
--
ALTER TABLE `Device_History`
  MODIFY `Historyid` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `Devices`
--
ALTER TABLE `Devices`
  ADD CONSTRAINT `frk1` FOREIGN KEY (`Dtypeid`) REFERENCES `Device_Type` (`Dtypeid`),
  ADD CONSTRAINT `frk2` FOREIGN KEY (`Sid`) REFERENCES `Sites` (`Sid`),
  ADD CONSTRAINT `frk3` FOREIGN KEY (`DeRoleid`) REFERENCES `Device_Role` (`DeRoleid`);

--
-- Constraints for table `Device_Type`
--
ALTER TABLE `Device_Type`
  ADD CONSTRAINT `frk_type1` FOREIGN KEY (`Mid`) REFERENCES `Manufacturer` (`Mid`);

--
-- Constraints for table `Device_History`
--
ALTER TABLE `Device_History`
  ADD CONSTRAINT `frk_history1` FOREIGN KEY (`Did`) REFERENCES `Devices` (`Did`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
