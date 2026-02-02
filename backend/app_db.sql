-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: db:3306
-- Generation Time: Feb 02, 2026 at 07:52 AM
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
-- Database: `app_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `contract`
--

CREATE TABLE `contract` (
  `contract_id` int(11) NOT NULL,
  `contract_name` varchar(255) DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `device_id` int(11) DEFAULT NULL COMMENT 'FK -> devices(Did)',
  `site_id` int(11) DEFAULT NULL COMMENT 'FK -> sites_location(SLid)',
  `sof_name` varchar(255) DEFAULT NULL,
  `sla_term` int(255) NOT NULL,
  `Assigned_Service` varchar(100) DEFAULT NULL,
  `pm_time_per_year` enum('1','2','3','4','5') NOT NULL DEFAULT '2',
  `sale_account` varchar(255) DEFAULT NULL,
  `coverage_scope` text DEFAULT NULL COMMENT 'มีไว้ทำไมไม่รู้แต่ต้องมีนะ',
  `file_paths` text DEFAULT NULL COMMENT 'JSON array of file paths',
  `image_paths` text DEFAULT NULL COMMENT 'JSON array of image paths'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `contract_device`
--

CREATE TABLE `contract_device` (
  `contract_id` int(11) NOT NULL,
  `device_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `contract_history`
--

CREATE TABLE `contract_history` (
  `history_id` int(11) NOT NULL AUTO_INCREMENT,
  `contract_id` int(11) NOT NULL COMMENT 'FK -> contract(contract_id) - สัญญาใหม่',
  `old_contract_id` int(11) DEFAULT NULL COMMENT 'FK -> contract(contract_id) - สัญญาเก่าที่ต่ออายุ',
  `old_sof` varchar(255) DEFAULT NULL COMMENT 'SOF จากสัญญาเก่า',
  `new_sof` varchar(255) DEFAULT NULL COMMENT 'SOF ของสัญญาใหม่',
  `renewed_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่ต่อสัญญา',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`history_id`),
  KEY `idx_contract_id` (`contract_id`),
  KEY `idx_old_contract_id` (`old_contract_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ประวัติการต่อสัญญา';

-- --------------------------------------------------------

--
-- Table structure for table `contract_site`
--

CREATE TABLE `contract_site` (
  `contract_id` int(11) NOT NULL,
  `SLid` int(11) NOT NULL COMMENT 'FK -> sites_location(SLid)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
-- Dumping data for table `devices`
--

INSERT INTO `devices` (`Did`, `Asset_State`, `serial`, `CI_Name`, `Asset_Number`, `PR_No`, `Vendor`, `Project_purchase`, `SLid`, `PO_No`, `Loan_Start`, `Request_Date`, `Refer_SOF`, `Refer_Ticket`, `Assigned_Service`, `Reason`, `Dtypeid`, `DeRoleid`, `Project_code_purchase`, `Waranty_start`, `Waranty_end`, `Received_date`, `Asset_Type`, `Owner`) VALUES
(1, 'In Use', 'FGL2314A91L', 'AIR-AP3802I-S-K9 / FGL2314A91L', '4300000627', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 2, 3, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(2, 'In Store', 'FGL2314A91M', 'AIR-AP3802I-S-K9 / FGL2314A91M', '4300000579', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 2, 3, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(3, 'In Use', 'FGL2314A91N', 'AIR-AP3802I-S-K9 / FGL2314A91N', '4300000580', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 3, 2, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(4, 'In Use', 'FGL2314A91P', 'AIR-AP3802I-S-K9 / FGL2314A91P', '4300000581', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 2, '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(5, 'In Use', 'FGL2314A91Q', 'AIR-AP3802I-S-K9 / FGL2314A91Q', '4300000582', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 4, 2, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(6, 'In Store', 'FGL2314A91R', 'AIR-AP3802I-S-K9 / FGL2314A91R', '4300000583', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 3, 2, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(7, 'In Use', 'FGL2314A91S', 'AIR-AP3802I-S-K9 / FGL2314A91S', '4300000584', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(8, 'In Use', 'FGL2314A91T', 'AIR-AP3802I-S-K9 / FGL2314A91T', '4300000585', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(9, 'In Use', 'FGL2314A91U', 'AIR-AP3802I-S-K9 / FGL2314A91U', '4300000586', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(10, 'In Use', 'FGL2314A91V', 'AIR-AP3802I-S-K9 / FGL2314A91V', '4300000587', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(11, 'In Store', 'FGL2314A91W', 'AIR-AP3802I-S-K9 / FGL2314A91W', '4300000588', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(12, 'In Use', 'FGL2314A92D', 'AIR-AP3802I-S-K9 / FGL2314A92D', '4300000594', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 2, '8931006623', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(13, 'In Use', 'FGL2322A8BU', 'AIR-AP3802I-S-K9 / FGL2322A8BU', '4300000628', '/PR8911007273', 'NETWORK SURE', 'Cosmos', 3, '8931006625', 'Not Assigned', '21-09-2023', '8910019218', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(14, 'In Use', 'FGL2322A8BV', 'AIR-AP3802I-S-K9 / FGL2322A8BV', '4300000629', '/PR8911007273', 'NETWORK SURE', 'Cosmos', 3, '8931006625', 'Not Assigned', '21-09-2023', '8910019218', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(15, 'Waiting to sell', 'FGL2322A8BY', 'AIR-AP3802I-S-K9 / FGL2322A8BY', '4300000630', '/PR8911007273', 'NETWORK SURE', 'Cosmos', 3, '8931006625', 'Not Assigned', '21-09-2023', '8910019218', NULL, 'Not Assigned', 'Not Assigned', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(16, 'In Use', 'FGL2322A8D0', 'AIR-AP3802I-S-K9 / FGL2322A8D0', '4300000631', '/PR8911007273', 'NETWORK SURE', 'Cosmos', 3, '8931006625', 'Not Assigned', '21-09-2023', '8910019218', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(17, 'In Use', 'FGL2322A8D1', 'AIR-AP3802I-S-K9 / FGL2322A8D1', '4300000632', '/PR8911007273', 'NETWORK SURE', 'Cosmos', 3, '8931006625', 'Not Assigned', '21-09-2023', '8910019218', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(18, 'In Use', 'FGL2322A8D2', 'AIR-AP3802I-S-K9 / FGL2322A8D2', '4300000633', '/PR8911007273', 'NETWORK SURE', 'Cosmos', 3, '8931006625', 'Not Assigned', '21-09-2023', '8910019218', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(19, 'In Use', 'C17366663000006171', 'AIR-PWRINJ6 / C17366663000006171', '4300000615', '/PR8911007271', 'NETWORK SURE', 'Beerthip Bang Ban', 4, '8931006624', 'Not Assigned', '14-ต.ค.-25', '8910018077', NULL, 'Device Network Manage Service', 'Replacement', 2, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(20, 'In Store', 'PHI2326015W', 'AIR-PWRINJ6 / PHI2326015W', '4300000620', '/PR8911007271', 'NETWORK SURE', 'Beerthip Bang Ban', 1, '8931006624', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 2, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(21, 'In Use', 'FGL2322A8DL', 'AIR-AP3802I-S-K9 / FGL2322A8DL', '4300000636', '/PR8911007273', 'NETWORK SURE', 'Cosmos', 3, '8931006625', 'Not Assigned', '21-09-2023', '8910019218', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(22, 'In Use', 'FGL2322A8DM', 'AIR-AP3802I-S-K9 / FGL2322A8DM', '4300000637', '/PR8911007273', 'NETWORK SURE', 'Cosmos', 3, '8931006625', 'Not Assigned', '21-09-2023', '8910019218', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(23, 'Waiting to sell', 'FGL2322A8DQ', 'AIR-AP3802I-S-K9 / FGL2322A8DQ', '4300000638', '/PR8911007273', 'NETWORK SURE', 'Cosmos', 3, '8931006625', 'Not Assigned', '21-09-2023', '8910019218', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(24, 'In Use', 'FCW2106B5E3', 'WS-C2960X-24PS-L / FCW2106B5E3', '4300000641', '/PR8911007273', 'NETWORK SURE', 'Cosmos', 1, '8931006625', 'Not Assigned', 'Not Assigned', 'test', NULL, 'test', 'Not Assigned', 3, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(25, 'In Store', 'KWC24230DGM', 'AIR-AP1852I-E-K9 / KWC24230DGM', '4300000360', '8911006695', 'NETWORK SURE', 'MA Thaibev', 2, '8931006091', 'Not Assigned', 'Not Assigned', 'Not Assigned\r\n', NULL, '', 'Not Assigned', 4, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(26, 'In Store On Site', 'KWC24230DGN', 'AIR-AP1852I-E-K9 / KWC24230DGN', '4300000361', '8911006695', 'NETWORK SURE', 'MA Thaibev', 6, '8931006091', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 4, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(27, 'In Store On Site', 'KWC24230DGS', 'AIR-AP1852I-E-K9 / KWC24230DGS', '4300000362', '8911006695', 'NETWORK SURE', 'MA Thaibev', 7, '8931006091', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 4, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(28, 'In Use', 'KWC24230DGZ', 'AIR-AP1852I-E-K9 / KWC24230DGZ', '4300000363', '8911006695', 'NETWORK SURE', 'MA Thaibev', 8, '8931006091', 'Not Assigned', '21-พ.ค.-24', '8910018437', NULL, 'Device Network Rental Service', 'Replacement', 4, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(29, 'Waiting to sell', 'KWC210607J0', 'AIR-AP1852I-S-K9 / KWC210607J0', '4200022757', '8911005365', 'NETWORK SURE', 'บริษัท ทิพย์พิจิตร ไฮบริดเอนเนอยี่ จำกัด', 9, '8931004691', 'Not Assigned', '30-03-23', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 5, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(30, 'In Use', 'KWC2135031K', 'AIR-AP1852I-S-K9 / KWC2135031K', '4200022757', '8911006857', 'NETWORK SURE', 'MA Thaibev', 10, '8931006149', 'Not Assigned', '16-06-23', 'Not Assigned', NULL, 'Device Network Manage Service', 'Replacement', 5, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(31, 'In Store', 'KWC214705XW', 'AIR-AP1852I-S-K9 / KWC214705XW', '4300000344', '8911006857', 'NETWORK SURE', 'MA Thaibev', 11, '8931006149', 'Not Assigned', '6-พ.ย.-23', 'Not Assigned', NULL, 'Network as a Service', 'Replacement', 5, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(32, 'Waiting to sell', 'KWC214705ZL', 'AIR-AP1852I-S-K9 / KWC214705ZL', '4300000045', '8911005365', 'NETWORK SURE', 'บริษัท ทิพย์พิจิตร ไฮบริดเอนเนอยี่ จำกัด', 11, '8931004691', 'Not Assigned', '9-พ.ค.-22', '8910014954', NULL, 'Not Assigned', 'Not Assigned', 5, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(33, 'In Use', 'KWC214705ZX', 'AIR-AP1852I-S-K9 / KWC214705ZX', '4300000046', '8911005365', 'NETWORK SURE', 'บริษัท ทิพย์พิจิตร ไฮบริดเอนเนอยี่ จำกัด', 11, '8931004691', 'Not Assigned', '9-พ.ค.-22', '8910014954', NULL, 'Network as a Service', 'New Installation', 5, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(34, 'In Use', 'KWC214901DK', 'AIR-AP1852I-S-K9 / KWC214901DK', '4300000109', '8911005825', 'NETWORK SURE', 'C A C Co., Ltd', 12, '8931005120', 'Not Assigned', '31-10-22', '8910016691', NULL, 'Not Assigned', 'Not Assigned', 5, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(35, 'In Use', 'KWC222803UY', 'AIR-AP1852I-S-K9 / KWC222803UY', '4300000530', '8911007225', 'NETWORK SURE', 'Cyber World Bldg.', 13, '8931006527', 'Not Assigned', '7-ส.ค.-23', '8910019823', NULL, 'Not Assigned', 'Not Assigned', 5, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(36, 'In Use', 'KWC222803ZU', 'AIR-AP1852I-S-K9 / KWC222803ZU', '4300000531', '8911007225', 'NETWORK SURE', 'Cyber World Bldg.', 13, '8931006527', 'Not Assigned', '7-ส.ค.-23', '8910019823', NULL, 'Not Assigned', 'Not Assigned', 5, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(37, 'In Use', 'KWC22290C2Y', 'AIR-AP1852I-S-K9 / KWC22290C2Y', '4300000176', '8911006660', 'Network Sure', 'Surawong AP Rental', 14, '8931005955', 'Not Assigned', '25-03-23', '8910018437', NULL, '8910018437', 'New Installation', 5, 2, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(38, 'In Use', 'KWC2447074U', 'AIR-AP1852I-S-K9 / KWC2447074U', '4300000177', '8911006660', 'Network Sure', 'Surawong AP Rental', 15, '8931005955', 'Not Assigned', '7-ส.ค.-24', '8910020956', NULL, 'Not Assigned', 'Not Assigned', 5, 2, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(39, 'In Use', 'KWC2230004B', 'AIR-AP1852I-S-K9 / KWC2230004B', '4300000532', '8911007225', 'NETWORK SURE', 'Cyber World Bldg.', 13, '8931006527', 'Not Assigned', '7-ส.ค.-23', '8910019823', NULL, 'Not Assigned', 'Not Assigned', 5, 2, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(40, 'In Use', 'KWC223205F7', 'AIR-AP1852I-S-K9 / KWC223205F7', '4300000178', '8911006660', 'Network Sure', 'Surawong AP Rental', 16, '8931005955', 'Not Assigned', '25-03-23', '8910017548', NULL, 'Not Assigned', 'Not Assigned', 5, 2, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(41, 'In Use', 'KWC223206E0', 'AIR-AP1852I-S-K9 / KWC223206E0', '4300000179', '8911006660', 'Network Sure', 'Surawong AP Rental', 17, '8931005955', 'Not Assigned', '25-03-23', '8910018437', NULL, 'Device Network Rental Service', 'New Installation', 5, 2, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(42, 'In Use', 'KWC223208C5', 'AIR-AP1852I-S-K9 / KWC223208C5', '4300000345', '8911006857', 'NETWORK SURE', 'MA Thaibev', 11, '8931006149', 'Not Assigned', '22-05-23', 'Not Assigned', NULL, 'Network as a Service', 'Replacement', 5, 2, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(43, 'In Use', 'UPS01', 'Easy UPS SRV RM 1000VA Rack / UPS01', '4300000670', 'PR8911007855', 'เวเปอร์ เทค จำกัด', 'ASMM Silom Edge 20th Fl.', 18, '8931007223', 'Not Assigned', '22-ต.ค.-23', '8910021263', NULL, 'Network as a Service', 'New Installation', 6, 2, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(44, 'In Use', 'FGT61FTK20027631', 'FG-61F-BDL-950-36 / FGT61FTK20027631', '4300000001', '8911003902', 'เอ็นทีที (ประเทศไทย)', 'TBL_Wangnoi', 19, '8931003422', 'Not Assigned', '22-04-22', '8910011992', NULL, '8910011992', 'New Installation', 7, 2, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(45, 'In Use', 'FGT61FTK20028094', 'FG-61F-BDL-950-36 / FGT61FTK20028094', '4300000002', '8911003902', 'เอ็นทีที (ประเทศไทย)', 'TBL_Wangnoi', 19, '8931003422', 'Not Assigned', '22-04-22', '8910011992', NULL, '8910011992', 'New Installation', 7, 2, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(46, 'In Use', 'FGT61FTK23003621', 'Firewall FortiGate 61F FG-61F / FGT61FTK23003621', '4200026511', NULL, 'เอ็นทีที (ประเทศไทย)', 'บริษัท โออิชิ เทรดดิ้ง จำกัด', 20, '8931007187', 'Not Assigned', '23/11/23', 'Not Assigned', NULL, 'Network as a Service', 'New Installation', 8, 3, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(47, 'In Use', 'FGT61FTK23003917', 'Firewall FortiGate 61F FG-61F / FGT61FTK23003917', '4200026510', NULL, 'เอ็นทีที (ประเทศไทย)', 'บริษัท โออิชิ เทรดดิ้ง จำกัด', 21, '8931007186', 'Not Assigned', '23/11/23', 'Not Assigned', NULL, 'Network as a Service', 'New Installation', 8, 3, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(48, 'In Use', 'FGT61FTK23004452', 'Firewall FortiGate 61F FG-61F / FGT61FTK23004452', '4200026512', NULL, 'เอ็นทีที (ประเทศไทย)', 'บริษัท โออิชิ เทรดดิ้ง จำกัด', 22, '8931007188', 'Not Assigned', '23/11/23', 'Not Assigned', NULL, 'Network as a Service', 'New Installation', 8, 3, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(49, 'In Use', 'FGT61FTK22063593', 'Firewall,FG-61F 10xGE RJ45 ports,128GB / FGT61FTK22063593', '4300000473', '8911006833', 'ทรานซิสชั่น ซิสเต็มส์ แอนด์ เน็ทเวอร์คส', 'Project ASSC : [ThaiBev-SilomEdge]', 23, '8931006111', 'Not Assigned', 'Not Assigned', '8910018855', NULL, 'Network as a Service', 'New Installation', 9, 3, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(50, 'In Use', 'AC8BA9D33B6D', 'UQT-U6-MESH Access point / AC8BA9D33B6D', '4300000889', '/PR8911008377', 'SiS Distribution (Thailand) PLC.', 'SATHORN1', 24, '8931007727', 'Not Assigned', '15-ม.ค.-24', 'รอ SOF', NULL, 'Network as a Service', 'New Installation', 10, 3, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(51, 'In Use', 'AC8BA9D32875', 'UQT-U6-MESH Access point / AC8BA9D32875', '4300000874', '/PR8911008377', 'SiS Distribution (Thailand) PLC.', 'SATHORN1', 2, '8931007727', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 10, 3, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(52, 'In Use', 'AC8BA9D2DAE5', 'UQT-U6-MESH Access point / AC8BA9D2DAE5', '4300000877', '/PR8911008377', 'SiS Distribution (Thailand) PLC.', 'SATHORN1', 9, '8931007727', 'Not Assigned', 'Not Assigned', 'asd', NULL, 'asd', 'Not Assigned', 10, 3, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(53, 'In Use', 'AC8BA9D2D8DD', 'UQT-U6-MESH Access point / AC8BA9D2D8DD', '4300000884', '/PR8911008377', 'SiS Distribution (Thailand) PLC.', 'SATHORN1', 6, '8931007727', 'Not Assigned', 'Not Assigned', 'asd', NULL, 'asd', 'Not Assigned', 10, 3, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(54, 'In Use', 'FOC0821Z2SE', 'Access Switch WS-C2950C-24 / FOC0821Z2SE', '4300000946', '/Ref SOF 8910018076', 'SiS Distribution (Thailand) PLC.', 'MA Thaibev', 1, NULL, 'Not Assigned', 'Not Assigned', 'test', NULL, 'test', 'Not Assigned', 11, 3, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(55, 'In Store', 'FAB0545W29X', 'Access Switch WS-C2950C-24 / FAB0545W29X', '4300000947', '/Ref SOF 8910018076', 'SiS Distribution (Thailand) PLC.', 'MA Thaibev', 2, NULL, 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 11, 3, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(56, 'In Use', 'FOC0932Z544', 'Access Switch WS-C2950C-24 / FOC0932Z544', '4300000948', '/Ref SOF 8910018076', 'SiS Distribution (Thailand) PLC.', 'MA Thaibev', 1, NULL, 'Not Assigned', 'Not Assigned', 'test', NULL, 'test', 'Not Assigned', 11, 3, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(57, 'In Store', 'FAB0545W2AD', 'Access Switch WS-C2950C-24 / FAB0545W2AD', '4300000949', '/Ref SOF 8910018076', 'SiS Distribution (Thailand) PLC.', 'MA Thaibev', 2, NULL, 'Not Assigned', 'Not Assigned', '', NULL, '', 'Not Assigned', 11, 3, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL);

--
-- Triggers `devices`
--
DELIMITER $$
CREATE TRIGGER `trg_devices_insert` AFTER INSERT ON `devices` FOR EACH ROW BEGIN
    DECLARE v_sid INT DEFAULT NULL;
    DECLARE v_location2 VARCHAR(255) DEFAULT NULL;

    -- Get Sid and Location2 from SLid
    IF NEW.SLid IS NOT NULL THEN
        SELECT `SL`.`Sid`, `L`.`Location2`
        INTO v_sid, v_location2
        FROM `sites_location` AS `SL`
        JOIN `location` AS `L` ON `SL`.`lid` = `L`.`lid`
        WHERE `SL`.`SLid` = NEW.`SLid`
        LIMIT 1;
    END IF;

    INSERT INTO devices_history (
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
        Description
    ) VALUES (
        'INSERT',
        NOW(),
        NEW.Did,
        NEW.Asset_State,
        NEW.serial,
        NEW.CI_Name,
        NEW.Asset_Number,
        NEW.PR_No,
        NEW.Vendor,
        NEW.Project_purchase,
        v_sid,
        v_location2,
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
        COALESCE(@status_change_description, 'Import from Excel')
    );
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `trg_devices_update` AFTER UPDATE ON `devices` FOR EACH ROW BEGIN
    DECLARE v_sid INT DEFAULT NULL;
    DECLARE v_location2 VARCHAR(255) DEFAULT NULL;

    -- Get Sid and Location2 from SLid (use OLD.SLid for history)
    IF OLD.SLid IS NOT NULL THEN
        SELECT `SL`.`Sid`, `L`.`Location2`
        INTO v_sid, v_location2
        FROM `sites_location` AS `SL`
        JOIN `location` AS `L` ON `SL`.`lid` = `L`.`lid`
        WHERE `SL`.`SLid` = OLD.`SLid`
        LIMIT 1;
    END IF;

    INSERT INTO devices_history (
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
        Description
    ) VALUES (
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
        v_sid,
        v_location2,
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
        COALESCE(@status_change_description, 'Update from Excel')
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

--
-- Dumping data for table `devices_history`
--

INSERT INTO `devices_history` (`log_id`, `action_type`, `changed_at`, `Did`, `Asset_State`, `serial`, `CI_Name`, `Asset_Number`, `PR_No`, `Vendor`, `Project_purchase`, `Sid`, `Location2`, `PO_No`, `Loan_Start`, `Request_Date`, `Refer_SOF`, `Refer_Ticket`, `Assigned_Service`, `Reason`, `Dtypeid`, `DeRoleid`, `Project_code_purchase`, `Waranty_start`, `Waranty_end`, `Received_date`, `Asset_Type`, `Owner`, `Description`) VALUES
(1, 'INSERT', '2026-01-18 17:55:41', 1, 'In Use', 'FGL2314A91L', 'AIR-AP3802I-S-K9 / FGL2314A91L', '4300000627', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(2, 'INSERT', '2026-01-18 17:55:41', 2, 'In Use', 'FGL2314A91M', 'AIR-AP3802I-S-K9 / FGL2314A91M', '4300000579', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(3, 'INSERT', '2026-01-18 17:55:41', 3, 'In Use', 'FGL2314A91N', 'AIR-AP3802I-S-K9 / FGL2314A91N', '4300000580', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(4, 'INSERT', '2026-01-18 17:55:41', 4, 'In Use', 'FGL2314A91P', 'AIR-AP3802I-S-K9 / FGL2314A91P', '4300000581', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(5, 'INSERT', '2026-01-18 17:55:41', 5, 'In Use', 'FGL2314A91Q', 'AIR-AP3802I-S-K9 / FGL2314A91Q', '4300000582', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(6, 'INSERT', '2026-01-18 17:55:41', 6, 'In Use', 'FGL2314A91R', 'AIR-AP3802I-S-K9 / FGL2314A91R', '4300000583', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(7, 'INSERT', '2026-01-18 17:55:41', 7, 'In Use', 'FGL2314A91S', 'AIR-AP3802I-S-K9 / FGL2314A91S', '4300000584', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(8, 'INSERT', '2026-01-18 17:55:41', 8, 'In Use', 'FGL2314A91T', 'AIR-AP3802I-S-K9 / FGL2314A91T', '4300000585', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(9, 'INSERT', '2026-01-18 17:55:41', 9, 'In Use', 'FGL2314A91U', 'AIR-AP3802I-S-K9 / FGL2314A91U', '4300000586', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(10, 'INSERT', '2026-01-18 17:55:41', 10, 'In Use', 'FGL2314A91V', 'AIR-AP3802I-S-K9 / FGL2314A91V', '4300000587', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(11, 'INSERT', '2026-01-18 17:55:41', 11, 'In Use', 'FGL2314A91W', 'AIR-AP3802I-S-K9 / FGL2314A91W', '4300000588', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(12, 'INSERT', '2026-01-18 17:55:41', 12, 'In Store', 'FGL2314A92D', 'AIR-AP3802I-S-K9 / FGL2314A92D', '4300000594', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 2, 'BNDC 4110', '8931006623', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(13, 'INSERT', '2026-01-18 17:55:41', 13, 'In Use', 'FGL2322A8BU', 'AIR-AP3802I-S-K9 / FGL2322A8BU', '4300000628', '/PR8911007273', 'NETWORK SURE', 'Cosmos', 1, 'คอสมอส', '8931006625', 'Not Assigned', '21-09-2023', '8910019218', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(14, 'INSERT', '2026-01-18 17:55:41', 14, 'In Use', 'FGL2322A8BV', 'AIR-AP3802I-S-K9 / FGL2322A8BV', '4300000629', '/PR8911007273', 'NETWORK SURE', 'Cosmos', 1, 'คอสมอส', '8931006625', 'Not Assigned', '21-09-2023', '8910019218', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(15, 'INSERT', '2026-01-18 17:55:41', 15, 'Waiting to sell', 'FGL2322A8BY', 'AIR-AP3802I-S-K9 / FGL2322A8BY', '4300000630', '/PR8911007273', 'NETWORK SURE', 'Cosmos', 1, 'คอสมอส', '8931006625', 'Not Assigned', '21-09-2023', '8910019218', NULL, 'Not Assigned', 'Not Assigned', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(16, 'INSERT', '2026-01-18 17:55:41', 16, 'In Use', 'FGL2322A8D0', 'AIR-AP3802I-S-K9 / FGL2322A8D0', '4300000631', '/PR8911007273', 'NETWORK SURE', 'Cosmos', 1, 'คอสมอส', '8931006625', 'Not Assigned', '21-09-2023', '8910019218', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(17, 'INSERT', '2026-01-18 17:55:41', 17, 'In Use', 'FGL2322A8D1', 'AIR-AP3802I-S-K9 / FGL2322A8D1', '4300000632', '/PR8911007273', 'NETWORK SURE', 'Cosmos', 1, 'คอสมอส', '8931006625', 'Not Assigned', '21-09-2023', '8910019218', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(18, 'INSERT', '2026-01-18 17:55:41', 18, 'In Use', 'FGL2322A8D2', 'AIR-AP3802I-S-K9 / FGL2322A8D2', '4300000633', '/PR8911007273', 'NETWORK SURE', 'Cosmos', 1, 'คอสมอส', '8931006625', 'Not Assigned', '21-09-2023', '8910019218', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(19, 'INSERT', '2026-01-18 17:55:41', 19, 'In Use', 'C17366663000006171', 'AIR-PWRINJ6 / C17366663000006171', '4300000615', '/PR8911007271', 'NETWORK SURE', 'Beerthip Bang Ban', 3, 'บริษัท โออิชิ เทรดดิ้ง จำกัด (นวนคร)', '8931006624', 'Not Assigned', '14-ต.ค.-25', '8910018077', NULL, 'Device Network Manage Service', 'Replacement', 2, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(20, 'INSERT', '2026-01-18 17:55:41', 20, 'In Store', 'PHI2326015W', 'AIR-PWRINJ6 / PHI2326015W', '4300000620', '/PR8911007271', 'NETWORK SURE', 'Beerthip Bang Ban', 2, 'BNDC 4110', '8931006624', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 2, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(21, 'INSERT', '2026-01-18 17:55:41', 21, 'In Use', 'FGL2322A8DL', 'AIR-AP3802I-S-K9 / FGL2322A8DL', '4300000636', '/PR8911007273', 'NETWORK SURE', 'Cosmos', 1, 'คอสมอส', '8931006625', 'Not Assigned', '21-09-2023', '8910019218', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(22, 'INSERT', '2026-01-18 17:55:41', 22, 'In Use', 'FGL2322A8DM', 'AIR-AP3802I-S-K9 / FGL2322A8DM', '4300000637', '/PR8911007273', 'NETWORK SURE', 'Cosmos', 1, 'คอสมอส', '8931006625', 'Not Assigned', '21-09-2023', '8910019218', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(23, 'INSERT', '2026-01-18 17:55:41', 23, 'Waiting to sell', 'FGL2322A8DQ', 'AIR-AP3802I-S-K9 / FGL2322A8DQ', '4300000638', '/PR8911007273', 'NETWORK SURE', 'Cosmos', 1, 'คอสมอส', '8931006625', 'Not Assigned', '21-09-2023', '8910019218', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(24, 'INSERT', '2026-01-18 17:55:41', 24, 'In Store', 'FCW2106B5E3', 'WS-C2960X-24PS-L / FCW2106B5E3', '4300000641', '/PR8911007273', 'NETWORK SURE', 'Cosmos', 2, 'BNDC 4110', '8931006625', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 3, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(25, 'INSERT', '2026-01-18 17:55:41', 25, 'In Store On Site', 'KWC24230DGM', 'AIR-AP1852I-E-K9 / KWC24230DGM', '4300000360', '8911006695', 'NETWORK SURE', 'MA Thaibev', 4, 'ศูนย์ย่อยนครสวรรค์', '8931006091', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 4, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(26, 'INSERT', '2026-01-18 17:55:41', 26, 'In Store On Site', 'KWC24230DGN', 'AIR-AP1852I-E-K9 / KWC24230DGN', '4300000361', '8911006695', 'NETWORK SURE', 'MA Thaibev', 4, 'ศูนย์ขอนแก่น', '8931006091', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 4, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(27, 'INSERT', '2026-01-18 17:55:41', 27, 'In Store On Site', 'KWC24230DGS', 'AIR-AP1852I-E-K9 / KWC24230DGS', '4300000362', '8911006695', 'NETWORK SURE', 'MA Thaibev', 4, 'ศูนย์นครราชสีมา', '8931006091', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 4, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(28, 'INSERT', '2026-01-18 17:55:41', 28, 'In Use', 'KWC24230DGZ', 'AIR-AP1852I-E-K9 / KWC24230DGZ', '4300000363', '8911006695', 'NETWORK SURE', 'MA Thaibev', 5, 'TCC-Private', '8931006091', 'Not Assigned', '21-พ.ค.-24', '8910018437', NULL, 'Device Network Rental Service', 'Replacement', 4, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(29, 'INSERT', '2026-01-18 17:55:41', 29, 'Waiting to sell', 'KWC210607J0', 'AIR-AP1852I-S-K9 / KWC210607J0', '4200022757', '8911005365', 'NETWORK SURE', 'บริษัท ทิพย์พิจิตร ไฮบริดเอนเนอยี่ จำกัด', 1, 'บริษัท คอสมอส บริวเวอรี่ (ประเทศไทย) จำกัด', '8931004691', 'Not Assigned', '30-03-23', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 5, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(30, 'INSERT', '2026-01-18 17:55:41', 30, 'In Use', 'KWC2135031K', 'AIR-AP1852I-S-K9 / KWC2135031K', '4200022757', '8911006857', 'NETWORK SURE', 'MA Thaibev', 1, 'แสงโสม พหลโยธิน Fl.4', '8931006149', 'Not Assigned', '16-06-23', 'Not Assigned', NULL, 'Device Network Manage Service', 'Replacement', 5, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(31, 'INSERT', '2026-01-18 17:55:41', 31, 'In Use', 'KWC214705XW', 'AIR-AP1852I-S-K9 / KWC214705XW', '4300000344', '8911006857', 'NETWORK SURE', 'MA Thaibev', 6, 'โรงไฟฟ้าพิจิตร', '8931006149', 'Not Assigned', '6-พ.ย.-23', 'Not Assigned', NULL, 'Network as a Service', 'Replacement', 5, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(32, 'INSERT', '2026-01-18 17:55:41', 32, 'Waiting to sell', 'KWC214705ZL', 'AIR-AP1852I-S-K9 / KWC214705ZL', '4300000045', '8911005365', 'NETWORK SURE', 'บริษัท ทิพย์พิจิตร ไฮบริดเอนเนอยี่ จำกัด', 6, 'โรงไฟฟ้าพิจิตร', '8931004691', 'Not Assigned', '9-พ.ค.-22', '8910014954', NULL, 'Not Assigned', 'Not Assigned', 5, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(33, 'INSERT', '2026-01-18 17:55:41', 33, 'In Use', 'KWC214705ZX', 'AIR-AP1852I-S-K9 / KWC214705ZX', '4300000046', '8911005365', 'NETWORK SURE', 'บริษัท ทิพย์พิจิตร ไฮบริดเอนเนอยี่ จำกัด', 6, 'โรงไฟฟ้าพิจิตร', '8931004691', 'Not Assigned', '9-พ.ค.-22', '8910014954', NULL, 'Network as a Service', 'New Installation', 5, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(34, 'INSERT', '2026-01-18 17:55:41', 34, 'Waiting to sell', 'KWC214901DK', 'AIR-AP1852I-S-K9 / KWC214901DK', '4300000109', '8911005825', 'NETWORK SURE', 'C A C Co., Ltd', 7, 'QSNCC', '8931005120', 'Not Assigned', '31-10-22', '8910016691', NULL, 'Not Assigned', 'Not Assigned', 5, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(35, 'INSERT', '2026-01-18 17:55:41', 35, 'In Store', 'KWC222803UY', 'AIR-AP1852I-S-K9 / KWC222803UY', '4300000530', '8911007225', 'NETWORK SURE', 'Cyber World Bldg.', 8, 'ASSC office at CW Tower 5Fl.', '8931006527', 'Not Assigned', '7-ส.ค.-23', '8910019823', NULL, 'Not Assigned', 'Not Assigned', 5, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(36, 'INSERT', '2026-01-18 17:55:41', 36, 'In Store', 'KWC222803ZU', 'AIR-AP1852I-S-K9 / KWC222803ZU', '4300000531', '8911007225', 'NETWORK SURE', 'Cyber World Bldg.', 8, 'ASSC office at CW Tower 5Fl.', '8931006527', 'Not Assigned', '7-ส.ค.-23', '8910019823', NULL, 'Not Assigned', 'Not Assigned', 5, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(37, 'INSERT', '2026-01-18 17:55:41', 37, 'In Use', 'KWC22290C2Y', 'AIR-AP1852I-S-K9 / KWC22290C2Y', '4300000176', '8911006660', 'Network Sure', 'Surawong AP Rental', 9, 'TCB FL2', '8931005955', 'Not Assigned', '25-03-23', '8910018437', NULL, 'Device Network Rental Service', 'New Installation', 5, 2, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(38, 'INSERT', '2026-01-18 17:55:41', 38, 'Waiting to sell', 'KWC2447074U', 'AIR-AP1852I-S-K9 / KWC2447074U', '4300000177', '8911006660', 'Network Sure', 'Surawong AP Rental', 9, 'TCC Private/TCB FL3,TCC8 FL8', '8931005955', 'Not Assigned', '7-ส.ค.-24', '8910020956', NULL, 'Not Assigned', 'Not Assigned', 5, 2, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(39, 'INSERT', '2026-01-18 17:55:41', 39, 'In Store', 'KWC2230004B', 'AIR-AP1852I-S-K9 / KWC2230004B', '4300000532', '8911007225', 'NETWORK SURE', 'Cyber World Bldg.', 8, 'ASSC office at CW Tower 5Fl.', '8931006527', 'Not Assigned', '7-ส.ค.-23', '8910019823', NULL, 'Not Assigned', 'Not Assigned', 5, 2, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(40, 'INSERT', '2026-01-18 17:55:41', 40, 'Waiting to sell', 'KWC223205F7', 'AIR-AP1852I-S-K9 / KWC223205F7', '4300000178', '8911006660', 'Network Sure', 'Surawong AP Rental', 9, 'TCC FL6', '8931005955', 'Not Assigned', '25-03-23', '8910017548', NULL, 'Not Assigned', 'Not Assigned', 5, 2, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(41, 'INSERT', '2026-01-18 17:55:41', 41, 'In Use', 'KWC223206E0', 'AIR-AP1852I-S-K9 / KWC223206E0', '4300000179', '8911006660', 'Network Sure', 'Surawong AP Rental', 9, 'TCB FL5', '8931005955', 'Not Assigned', '25-03-23', '8910018437', NULL, 'Device Network Rental Service', 'New Installation', 5, 2, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(42, 'INSERT', '2026-01-18 17:55:41', 42, 'In Use', 'KWC223208C5', 'AIR-AP1852I-S-K9 / KWC223208C5', '4300000345', '8911006857', 'NETWORK SURE', 'MA Thaibev', 6, 'โรงไฟฟ้าพิจิตร', '8931006149', 'Not Assigned', '22-05-23', 'Not Assigned', NULL, 'Network as a Service', 'Replacement', 5, 2, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(43, 'INSERT', '2026-01-18 17:55:41', 43, 'In Use', 'UPS01', 'Easy UPS SRV RM 1000VA Rack / UPS01', '4300000670', 'PR8911007855', 'เวเปอร์ เทค จำกัด', 'ASMM Silom Edge 20th Fl.', 8, 'Silom Edge FL.20 room no.2003-2004', '8931007223', 'Not Assigned', '22-ต.ค.-23', '8910021263', NULL, 'Network as a Service', 'New Installation', 6, 2, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(44, 'INSERT', '2026-01-18 17:55:41', 44, 'In Use', 'FGT61FTK20027631', 'FG-61F-BDL-950-36 / FGT61FTK20027631', '4300000001', '8911003902', 'เอ็นทีที (ประเทศไทย)', 'TBL_Wangnoi', 10, 'Wang Noi Ayutaya', '8931003422', 'Not Assigned', '22-04-22', '8910011992', NULL, 'Network as a Service', 'New Installation', 7, 2, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(45, 'INSERT', '2026-01-18 17:55:41', 45, 'In Use', 'FGT61FTK20028094', 'FG-61F-BDL-950-36 / FGT61FTK20028094', '4300000002', '8911003902', 'เอ็นทีที (ประเทศไทย)', 'TBL_Wangnoi', 10, 'Wang Noi Ayutaya', '8931003422', 'Not Assigned', '22-04-22', '8910011992', NULL, 'Network as a Service', 'New Installation', 7, 2, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(46, 'INSERT', '2026-01-18 17:55:41', 46, 'In Use', 'FGT61FTK23003621', 'Firewall FortiGate 61F FG-61F / FGT61FTK23003621', '4200026511', NULL, 'เอ็นทีที (ประเทศไทย)', 'บริษัท โออิชิ เทรดดิ้ง จำกัด', 11, 'อมตะ', '8931007187', 'Not Assigned', '23/11/23', 'Not Assigned', NULL, 'Network as a Service', 'New Installation', 8, 3, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(47, 'INSERT', '2026-01-18 17:55:41', 47, 'In Use', 'FGT61FTK23003917', 'Firewall FortiGate 61F FG-61F / FGT61FTK23003917', '4200026510', NULL, 'เอ็นทีที (ประเทศไทย)', 'บริษัท โออิชิ เทรดดิ้ง จำกัด', 12, 'บ้านบึง', '8931007186', 'Not Assigned', '23/11/23', 'Not Assigned', NULL, 'Network as a Service', 'New Installation', 8, 3, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(48, 'INSERT', '2026-01-18 17:55:41', 48, 'In Use', 'FGT61FTK23004452', 'Firewall FortiGate 61F FG-61F / FGT61FTK23004452', '4200026512', NULL, 'เอ็นทีที (ประเทศไทย)', 'บริษัท โออิชิ เทรดดิ้ง จำกัด', 13, 'วังม่วง', '8931007188', 'Not Assigned', '23/11/23', 'Not Assigned', NULL, 'Network as a Service', 'New Installation', 8, 3, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(49, 'INSERT', '2026-01-18 17:55:41', 49, 'In Use', 'FGT61FTK22063593', 'Firewall,FG-61F 10xGE RJ45 ports,128GB / FGT61FTK22063593', '4300000473', '8911006833', 'ทรานซิสชั่น ซิสเต็มส์ แอนด์ เน็ทเวอร์คส', 'Project ASSC : [ThaiBev-SilomEdge]', 14, 'บริษัท โออิชิ เทรดดิ้ง จำกัด (นวนคร)', '8931006111', 'Not Assigned', 'Not Assigned', '8910018855', NULL, 'Network as a Service', 'New Installation', 9, 3, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(50, 'INSERT', '2026-01-18 17:55:41', 50, 'In Use', 'AC8BA9D33B6D', 'UQT-U6-MESH Access point / AC8BA9D33B6D', '4300000889', '/PR8911008377', 'SiS Distribution (Thailand) PLC.', 'SATHORN1', 15, 'SATHORN1', '8931007727', 'Not Assigned', '15-ม.ค.-24', 'รอ SOF', NULL, 'Network as a Service', 'New Installation', 10, 3, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(51, 'INSERT', '2026-01-18 17:55:41', 51, 'In Store', 'AC8BA9D32875', 'UQT-U6-MESH Access point / AC8BA9D32875', '4300000874', '/PR8911008377', 'SiS Distribution (Thailand) PLC.', 'SATHORN1', 2, 'BNDC 4110', '8931007727', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 10, 3, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(52, 'INSERT', '2026-01-18 17:55:41', 52, 'In Store', 'AC8BA9D2DAE5', 'UQT-U6-MESH Access point / AC8BA9D2DAE5', '4300000877', '/PR8911008377', 'SiS Distribution (Thailand) PLC.', 'SATHORN1', 2, 'BNDC 4110', '8931007727', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 10, 3, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(53, 'INSERT', '2026-01-18 17:55:41', 53, 'Borrow', 'AC8BA9D2D8DD', 'UQT-U6-MESH Access point / AC8BA9D2D8DD', '4300000884', '/PR8911008377', 'SiS Distribution (Thailand) PLC.', 'SATHORN1', 16, 'Borrowไป SCI', '8931007727', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 10, 3, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(54, 'INSERT', '2026-01-18 17:55:41', 54, 'In Store', 'FOC0821Z2SE', 'Access Switch WS-C2950C-24 / FOC0821Z2SE', '4300000946', '/Ref SOF 8910018076', 'SiS Distribution (Thailand) PLC.', 'MA Thaibev', 2, 'BNDC 4110', NULL, 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 11, 3, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(55, 'INSERT', '2026-01-18 17:55:41', 55, 'In Store', 'FAB0545W29X', 'Access Switch WS-C2950C-24 / FAB0545W29X', '4300000947', '/Ref SOF 8910018076', 'SiS Distribution (Thailand) PLC.', 'MA Thaibev', 2, 'BNDC 4110', NULL, 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 11, 3, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(56, 'INSERT', '2026-01-18 17:55:41', 56, 'In Store', 'FOC0932Z544', 'Access Switch WS-C2950C-24 / FOC0932Z544', '4300000948', '/Ref SOF 8910018076', 'SiS Distribution (Thailand) PLC.', 'MA Thaibev', 2, 'BNDC 4110', NULL, 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 11, 3, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(57, 'INSERT', '2026-01-18 17:55:41', 57, 'In Store', 'FAB0545W2AD', 'Access Switch WS-C2950C-24 / FAB0545W2AD', '4300000949', '/Ref SOF 8910018076', 'SiS Distribution (Thailand) PLC.', 'MA Thaibev', 2, 'BNDC 4110', NULL, 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 11, 3, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AA'),
(58, 'UPDATE', '2026-01-18 18:00:26', 51, 'In Store', 'AC8BA9D32875', 'UQT-U6-MESH Access point / AC8BA9D32875', '4300000874', '/PR8911008377', 'SiS Distribution (Thailand) PLC.', 'SATHORN1', 2, 'BNDC 4110', '8931007727', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 10, 3, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'SSS'),
(59, 'UPDATE', '2026-01-18 18:00:53', 57, 'In Store', 'FAB0545W2AD', 'Access Switch WS-C2950C-24 / FAB0545W2AD', '4300000949', '/Ref SOF 8910018076', 'SiS Distribution (Thailand) PLC.', 'MA Thaibev', 2, 'BNDC 4110', NULL, 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 11, 3, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AAA'),
(60, 'UPDATE', '2026-01-18 18:00:53', 56, 'In Store', 'FOC0932Z544', 'Access Switch WS-C2950C-24 / FOC0932Z544', '4300000948', '/Ref SOF 8910018076', 'SiS Distribution (Thailand) PLC.', 'MA Thaibev', 2, 'BNDC 4110', NULL, 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 11, 3, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AAA'),
(61, 'UPDATE', '2026-01-18 18:00:53', 55, 'In Store', 'FAB0545W29X', 'Access Switch WS-C2950C-24 / FAB0545W29X', '4300000947', '/Ref SOF 8910018076', 'SiS Distribution (Thailand) PLC.', 'MA Thaibev', 2, 'BNDC 4110', NULL, 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 11, 3, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AAA'),
(62, 'UPDATE', '2026-01-18 18:00:53', 54, 'In Store', 'FOC0821Z2SE', 'Access Switch WS-C2950C-24 / FOC0821Z2SE', '4300000946', '/Ref SOF 8910018076', 'SiS Distribution (Thailand) PLC.', 'MA Thaibev', 2, 'BNDC 4110', NULL, 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 11, 3, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AAA'),
(63, 'UPDATE', '2026-01-18 18:00:53', 53, 'Borrow', 'AC8BA9D2D8DD', 'UQT-U6-MESH Access point / AC8BA9D2D8DD', '4300000884', '/PR8911008377', 'SiS Distribution (Thailand) PLC.', 'SATHORN1', 16, 'Borrowไป SCI', '8931007727', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 10, 3, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AAA'),
(64, 'UPDATE', '2026-01-18 18:00:53', 52, 'In Store', 'AC8BA9D2DAE5', 'UQT-U6-MESH Access point / AC8BA9D2DAE5', '4300000877', '/PR8911008377', 'SiS Distribution (Thailand) PLC.', 'SATHORN1', 2, 'BNDC 4110', '8931007727', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 10, 3, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AAA'),
(65, 'UPDATE', '2026-01-18 18:00:53', 51, 'In Store On Site', 'AC8BA9D32875', 'UQT-U6-MESH Access point / AC8BA9D32875', '4300000874', '/PR8911008377', 'SiS Distribution (Thailand) PLC.', 'SATHORN1', 2, 'BNDC 4110', '8931007727', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 10, 3, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AAA'),
(66, 'UPDATE', '2026-01-18 18:00:53', 40, 'Waiting to sell', 'KWC223205F7', 'AIR-AP1852I-S-K9 / KWC223205F7', '4300000178', '8911006660', 'Network Sure', 'Surawong AP Rental', 9, 'TCC FL6', '8931005955', 'Not Assigned', '25-03-23', '8910017548', NULL, 'Not Assigned', 'Not Assigned', 5, 2, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AAA'),
(67, 'UPDATE', '2026-01-18 18:00:53', 39, 'In Store', 'KWC2230004B', 'AIR-AP1852I-S-K9 / KWC2230004B', '4300000532', '8911007225', 'NETWORK SURE', 'Cyber World Bldg.', 8, 'ASSC office at CW Tower 5Fl.', '8931006527', 'Not Assigned', '7-ส.ค.-23', '8910019823', NULL, 'Not Assigned', 'Not Assigned', 5, 2, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AAA'),
(68, 'UPDATE', '2026-01-18 18:00:53', 38, 'Waiting to sell', 'KWC2447074U', 'AIR-AP1852I-S-K9 / KWC2447074U', '4300000177', '8911006660', 'Network Sure', 'Surawong AP Rental', 9, 'TCC Private/TCB FL3,TCC8 FL8', '8931005955', 'Not Assigned', '7-ส.ค.-24', '8910020956', NULL, 'Not Assigned', 'Not Assigned', 5, 2, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AAA'),
(69, 'UPDATE', '2026-01-18 18:00:53', 36, 'In Store', 'KWC222803ZU', 'AIR-AP1852I-S-K9 / KWC222803ZU', '4300000531', '8911007225', 'NETWORK SURE', 'Cyber World Bldg.', 8, 'ASSC office at CW Tower 5Fl.', '8931006527', 'Not Assigned', '7-ส.ค.-23', '8910019823', NULL, 'Not Assigned', 'Not Assigned', 5, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AAA'),
(70, 'UPDATE', '2026-01-18 18:00:53', 35, 'In Store', 'KWC222803UY', 'AIR-AP1852I-S-K9 / KWC222803UY', '4300000530', '8911007225', 'NETWORK SURE', 'Cyber World Bldg.', 8, 'ASSC office at CW Tower 5Fl.', '8931006527', 'Not Assigned', '7-ส.ค.-23', '8910019823', NULL, 'Not Assigned', 'Not Assigned', 5, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AAA'),
(71, 'UPDATE', '2026-01-18 18:00:53', 34, 'Waiting to sell', 'KWC214901DK', 'AIR-AP1852I-S-K9 / KWC214901DK', '4300000109', '8911005825', 'NETWORK SURE', 'C A C Co., Ltd', 7, 'QSNCC', '8931005120', 'Not Assigned', '31-10-22', '8910016691', NULL, 'Not Assigned', 'Not Assigned', 5, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AAA'),
(72, 'UPDATE', '2026-01-23 14:40:59', 1, 'In Use', 'FGL2314A91L', 'AIR-AP3802I-S-K9 / FGL2314A91L', '4300000627', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(73, 'UPDATE', '2026-01-23 14:41:11', 2, 'In Use', 'FGL2314A91M', 'AIR-AP3802I-S-K9 / FGL2314A91M', '4300000579', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(74, 'UPDATE', '2026-01-23 14:41:27', 3, 'In Use', 'FGL2314A91N', 'AIR-AP3802I-S-K9 / FGL2314A91N', '4300000580', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(75, 'UPDATE', '2026-01-23 14:41:44', 5, 'In Use', 'FGL2314A91Q', 'AIR-AP3802I-S-K9 / FGL2314A91Q', '4300000582', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(76, 'UPDATE', '2026-01-23 14:45:22', 12, 'In Store', 'FGL2314A92D', 'AIR-AP3802I-S-K9 / FGL2314A92D', '4300000594', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 2, 'BNDC 4110', '8931006623', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(77, 'UPDATE', '2026-01-23 14:45:22', 6, 'In Use', 'FGL2314A91R', 'AIR-AP3802I-S-K9 / FGL2314A91R', '4300000583', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(78, 'UPDATE', '2026-01-23 14:47:30', 6, 'In Store', 'FGL2314A91R', 'AIR-AP3802I-S-K9 / FGL2314A91R', '4300000583', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(79, 'UPDATE', '2026-01-23 14:47:30', 11, 'In Use', 'FGL2314A91W', 'AIR-AP3802I-S-K9 / FGL2314A91W', '4300000588', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(80, 'UPDATE', '2026-01-23 17:06:23', 11, 'In Store', 'FGL2314A91W', 'AIR-AP3802I-S-K9 / FGL2314A91W', '4300000588', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(81, 'UPDATE', '2026-01-23 17:06:23', 4, 'In Use', 'FGL2314A91P', 'AIR-AP3802I-S-K9 / FGL2314A91P', '4300000581', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(82, 'UPDATE', '2026-01-23 17:07:32', 4, 'In Store', 'FGL2314A91P', 'AIR-AP3802I-S-K9 / FGL2314A91P', '4300000581', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(83, 'UPDATE', '2026-01-23 17:07:32', 11, 'In Use', 'FGL2314A91W', 'AIR-AP3802I-S-K9 / FGL2314A91W', '4300000588', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(84, 'UPDATE', '2026-01-27 09:38:49', 11, 'In Store', 'FGL2314A91W', 'AIR-AP3802I-S-K9 / FGL2314A91W', '4300000588', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(85, 'UPDATE', '2026-01-27 09:38:49', 7, 'In Use', 'FGL2314A91S', 'AIR-AP3802I-S-K9 / FGL2314A91S', '4300000584', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(86, 'UPDATE', '2026-01-27 09:54:56', 11, 'In Use', 'FGL2314A91W', 'AIR-AP3802I-S-K9 / FGL2314A91W', '4300000588', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(87, 'UPDATE', '2026-01-27 10:09:00', 7, 'In Store', 'FGL2314A91S', 'AIR-AP3802I-S-K9 / FGL2314A91S', '4300000584', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(88, 'UPDATE', '2026-01-27 11:03:20', 6, 'In Use', 'FGL2314A91R', 'AIR-AP3802I-S-K9 / FGL2314A91R', '4300000583', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(89, 'UPDATE', '2026-01-27 11:04:07', 2, 'In Use', 'FGL2314A91M', 'AIR-AP3802I-S-K9 / FGL2314A91M', '4300000579', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 2, 3, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(90, 'UPDATE', '2026-01-27 11:04:39', 6, 'In Use', 'FGL2314A91R', 'AIR-AP3802I-S-K9 / FGL2314A91R', '4300000583', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 3, 2, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(91, 'UPDATE', '2026-01-27 11:05:26', 2, 'In store', 'FGL2314A91M', 'AIR-AP3802I-S-K9 / FGL2314A91M', '4300000579', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 2, 3, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(92, 'UPDATE', '2026-01-27 11:05:26', 1, 'In Use', 'FGL2314A91L', 'AIR-AP3802I-S-K9 / FGL2314A91L', '4300000627', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 2, 3, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(93, 'UPDATE', '2026-01-28 11:01:49', 11, 'In Store', 'FGL2314A91W', 'AIR-AP3802I-S-K9 / FGL2314A91W', '4300000588', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(94, 'UPDATE', '2026-01-28 11:01:49', 4, 'In Use', 'FGL2314A91P', 'AIR-AP3802I-S-K9 / FGL2314A91P', '4300000581', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(95, 'UPDATE', '2026-01-28 11:05:42', 2, 'In Use', 'FGL2314A91M', 'AIR-AP3802I-S-K9 / FGL2314A91M', '4300000579', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 2, 3, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(96, 'UPDATE', '2026-01-28 11:05:42', 1, 'In Store', 'FGL2314A91L', 'AIR-AP3802I-S-K9 / FGL2314A91L', '4300000627', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 2, 3, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(97, 'UPDATE', '2026-01-28 11:05:42', 1, 'In Use', 'FGL2314A91L', 'AIR-AP3802I-S-K9 / FGL2314A91L', '4300000627', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 2, 3, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(98, 'UPDATE', '2026-01-28 11:09:36', 4, 'In Store', 'FGL2314A91P', 'AIR-AP3802I-S-K9 / FGL2314A91P', '4300000581', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(99, 'UPDATE', '2026-01-28 11:09:36', 11, 'In Use', 'FGL2314A91W', 'AIR-AP3802I-S-K9 / FGL2314A91W', '4300000588', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(100, 'UPDATE', '2026-01-28 11:10:13', 2, 'In Store', 'FGL2314A91M', 'AIR-AP3802I-S-K9 / FGL2314A91M', '4300000579', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 2, 3, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(101, 'UPDATE', '2026-01-28 11:10:22', 2, 'In use', 'FGL2314A91M', 'AIR-AP3802I-S-K9 / FGL2314A91M', '4300000579', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 2, 3, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(102, 'UPDATE', '2026-01-28 11:10:33', 7, 'In use', 'FGL2314A91S', 'AIR-AP3802I-S-K9 / FGL2314A91S', '4300000584', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(103, 'UPDATE', '2026-01-28 11:16:13', 1, 'In Store', 'FGL2314A91L', 'AIR-AP3802I-S-K9 / FGL2314A91L', '4300000627', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 2, 3, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(104, 'UPDATE', '2026-01-28 11:16:13', 2, 'In Use', 'FGL2314A91M', 'AIR-AP3802I-S-K9 / FGL2314A91M', '4300000579', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 2, 3, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(105, 'UPDATE', '2026-01-29 15:49:42', 25, 'In Store On Site', 'KWC24230DGM', 'AIR-AP1852I-E-K9 / KWC24230DGM', '4300000360', '8911006695', 'NETWORK SURE', 'MA Thaibev', 4, 'ศูนย์ย่อยนครสวรรค์', '8931006091', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 4, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(106, 'UPDATE', '2026-01-29 15:50:14', 25, 'In Store', 'KWC24230DGM', 'AIR-AP1852I-E-K9 / KWC24230DGM', '4300000360', '8911006695', 'NETWORK SURE', 'MA Thaibev', 4, 'ศูนย์ย่อยนครสวรรค์', '8931006091', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 4, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(107, 'UPDATE', '2026-01-29 16:04:28', 25, 'In Store', 'KWC24230DGM', 'AIR-AP1852I-E-K9 / KWC24230DGM', '4300000360', '8911006695', 'NETWORK SURE', 'MA Thaibev', 4, 'ศูนย์ย่อยนครสวรรค์', '8931006091', 'Not Assigned', 'Not Assigned', '', NULL, 'Not Assigned', 'Not Assigned', 4, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(108, 'UPDATE', '2026-01-29 16:21:47', 55, 'In Use', 'FAB0545W29X', 'Access Switch WS-C2950C-24 / FAB0545W29X', '4300000947', '/Ref SOF 8910018076', 'SiS Distribution (Thailand) PLC.', 'MA Thaibev', 2, 'BNDC 4110', NULL, 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 11, 3, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(109, 'UPDATE', '2026-01-29 16:21:47', 57, 'In Use', 'FAB0545W2AD', 'Access Switch WS-C2950C-24 / FAB0545W2AD', '4300000949', '/Ref SOF 8910018076', 'SiS Distribution (Thailand) PLC.', 'MA Thaibev', 2, 'BNDC 4110', NULL, 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 11, 3, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(110, 'UPDATE', '2026-01-29 16:43:51', 6, 'In store', 'FGL2314A91R', 'AIR-AP3802I-S-K9 / FGL2314A91R', '4300000583', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 3, 2, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(111, 'UPDATE', '2026-01-29 16:55:35', 20, 'In Store', 'PHI2326015W', 'AIR-PWRINJ6 / PHI2326015W', '4300000620', '/PR8911007271', 'NETWORK SURE', 'Beerthip Bang Ban', 2, 'BNDC 4110', '8931006624', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 2, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(112, 'UPDATE', '2026-01-29 16:57:17', 20, 'In Store', 'PHI2326015W', 'AIR-PWRINJ6 / PHI2326015W', '4300000620', '/PR8911007271', 'NETWORK SURE', 'Beerthip Bang Ban', 1, 'Beer Thai', '8931006624', 'Not Assigned', 'Not Assigned', '8910021267', NULL, 'Not Assigned', 'Not Assigned', 2, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(113, 'UPDATE', '2026-01-29 17:00:16', 24, 'In Store', 'FCW2106B5E3', 'WS-C2960X-24PS-L / FCW2106B5E3', '4300000641', '/PR8911007273', 'NETWORK SURE', 'Cosmos', 2, 'BNDC 4110', '8931006625', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 3, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(114, 'UPDATE', '2026-01-29 17:06:58', 57, 'In Use', 'FAB0545W2AD', 'Access Switch WS-C2950C-24 / FAB0545W2AD', '4300000949', '/Ref SOF 8910018076', 'SiS Distribution (Thailand) PLC.', 'MA Thaibev', 1, 'Beer Thai', NULL, 'Not Assigned', 'Not Assigned', '8910019552', NULL, 'Not Assigned', 'Not Assigned', 11, 3, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(115, 'UPDATE', '2026-01-29 17:08:49', 25, 'In Store', 'KWC24230DGM', 'AIR-AP1852I-E-K9 / KWC24230DGM', '4300000360', '8911006695', 'NETWORK SURE', 'MA Thaibev', 4, 'ศูนย์ย่อยนครสวรรค์', '8931006091', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 4, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(116, 'UPDATE', '2026-01-29 17:09:51', 24, 'In Use', 'FCW2106B5E3', 'WS-C2960X-24PS-L / FCW2106B5E3', '4300000641', '/PR8911007273', 'NETWORK SURE', 'Cosmos', 1, 'Beer Thai', '8931006625', 'Not Assigned', 'Not Assigned', '8910021269', NULL, 'Not Assigned', 'Not Assigned', 3, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(117, 'UPDATE', '2026-01-29 17:10:34', 24, 'In Store', 'FCW2106B5E3', 'WS-C2960X-24PS-L / FCW2106B5E3', '4300000641', '/PR8911007273', 'NETWORK SURE', 'Cosmos', 1, 'Beer Thai', '8931006625', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 3, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(118, 'UPDATE', '2026-01-29 17:14:21', 25, 'In Store', 'KWC24230DGM', 'AIR-AP1852I-E-K9 / KWC24230DGM', '4300000360', '8911006695', 'NETWORK SURE', 'MA Thaibev', 2, 'BNDC 4110', '8931006091', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 4, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(119, 'UPDATE', '2026-01-29 17:14:21', 25, 'In Store', 'KWC24230DGM', 'AIR-AP1852I-E-K9 / KWC24230DGM', '4300000360', '8911006695', 'NETWORK SURE', 'MA Thaibev', 2, 'BNDC 4110', '8931006091', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, '1234567890', 'Not Assigned', 4, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(120, 'UPDATE', '2026-01-29 17:16:31', 25, 'In Use', 'KWC24230DGM', 'AIR-AP1852I-E-K9 / KWC24230DGM', '4300000360', '8911006695', 'NETWORK SURE', 'MA Thaibev', 1, 'Beer Thai', '8931006091', 'Not Assigned', 'Not Assigned', '1234567890', NULL, '1234567890', 'Not Assigned', 4, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(121, 'UPDATE', '2026-01-29 17:28:59', 25, 'In Store', 'KWC24230DGM', 'AIR-AP1852I-E-K9 / KWC24230DGM', '4300000360', '8911006695', 'NETWORK SURE', 'MA Thaibev', 2, 'BNDC 4110', '8931006091', 'Not Assigned', 'Not Assigned', '', NULL, '', 'Not Assigned', 4, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(122, 'UPDATE', '2026-01-30 09:51:13', 37, 'In Use', 'KWC22290C2Y', 'AIR-AP1852I-S-K9 / KWC22290C2Y', '4300000176', '8911006660', 'Network Sure', 'Surawong AP Rental', 9, 'TCB FL2', '8931005955', 'Not Assigned', '25-03-23', '8910018437', NULL, 'Device Network Rental Service', 'New Installation', 5, 2, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(123, 'UPDATE', '2026-01-30 10:00:15', 56, 'In Use', 'FOC0932Z544', 'Access Switch WS-C2950C-24 / FOC0932Z544', '4300000948', '/Ref SOF 8910018076', 'SiS Distribution (Thailand) PLC.', 'MA Thaibev', 2, 'BNDC 4110', NULL, 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 11, 3, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(124, 'UPDATE', '2026-01-30 10:00:54', 55, 'In Use', 'FAB0545W29X', 'Access Switch WS-C2950C-24 / FAB0545W29X', '4300000947', '/Ref SOF 8910018076', 'SiS Distribution (Thailand) PLC.', 'MA Thaibev', 1, 'Beer Thai', NULL, 'Not Assigned', 'Not Assigned', '8910019552', NULL, 'Not Assigned', 'Not Assigned', 11, 3, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(125, 'UPDATE', '2026-01-30 10:02:36', 31, 'In Use', 'KWC214705XW', 'AIR-AP1852I-S-K9 / KWC214705XW', '4300000344', '8911006857', 'NETWORK SURE', 'MA Thaibev', 6, 'โรงไฟฟ้าพิจิตร', '8931006149', 'Not Assigned', '6-พ.ย.-23', 'Not Assigned', NULL, 'Network as a Service', 'Replacement', 5, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(126, 'UPDATE', '2026-01-30 10:15:49', 54, 'In Use', 'FOC0821Z2SE', 'Access Switch WS-C2950C-24 / FOC0821Z2SE', '4300000946', '/Ref SOF 8910018076', 'SiS Distribution (Thailand) PLC.', 'MA Thaibev', 2, 'BNDC 4110', NULL, 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 11, 3, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(127, 'UPDATE', '2026-01-30 10:17:21', 53, 'In Use', 'AC8BA9D2D8DD', 'UQT-U6-MESH Access point / AC8BA9D2D8DD', '4300000884', '/PR8911008377', 'SiS Distribution (Thailand) PLC.', 'SATHORN1', 16, 'Borrowไป SCI', '8931007727', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 10, 3, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(128, 'UPDATE', '2026-01-30 10:17:36', 52, 'In Use', 'AC8BA9D2DAE5', 'UQT-U6-MESH Access point / AC8BA9D2DAE5', '4300000877', '/PR8911008377', 'SiS Distribution (Thailand) PLC.', 'SATHORN1', 2, 'BNDC 4110', '8931007727', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 10, 3, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(129, 'UPDATE', '2026-01-30 10:47:54', 54, 'In Store', 'FOC0821Z2SE', 'Access Switch WS-C2950C-24 / FOC0821Z2SE', '4300000946', '/Ref SOF 8910018076', 'SiS Distribution (Thailand) PLC.', 'MA Thaibev', 2, 'BNDC 4110', NULL, 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 11, 3, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(130, 'UPDATE', '2026-01-30 10:47:54', 57, 'In Store', 'FAB0545W2AD', 'Access Switch WS-C2950C-24 / FAB0545W2AD', '4300000949', '/Ref SOF 8910018076', 'SiS Distribution (Thailand) PLC.', 'MA Thaibev', 2, 'BNDC 4110', NULL, 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 11, 3, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel');
INSERT INTO `devices_history` (`log_id`, `action_type`, `changed_at`, `Did`, `Asset_State`, `serial`, `CI_Name`, `Asset_Number`, `PR_No`, `Vendor`, `Project_purchase`, `Sid`, `Location2`, `PO_No`, `Loan_Start`, `Request_Date`, `Refer_SOF`, `Refer_Ticket`, `Assigned_Service`, `Reason`, `Dtypeid`, `DeRoleid`, `Project_code_purchase`, `Waranty_start`, `Waranty_end`, `Received_date`, `Asset_Type`, `Owner`, `Description`) VALUES
(131, 'UPDATE', '2026-01-30 10:47:54', 57, 'In Store', 'FAB0545W2AD', 'Access Switch WS-C2950C-24 / FAB0545W2AD', '4300000949', '/Ref SOF 8910018076', 'SiS Distribution (Thailand) PLC.', 'MA Thaibev', 2, 'BNDC 4110', NULL, 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, '1234567890', 'Not Assigned', 11, 3, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(132, 'UPDATE', '2026-01-30 10:47:54', 54, 'In Store', 'FOC0821Z2SE', 'Access Switch WS-C2950C-24 / FOC0821Z2SE', '4300000946', '/Ref SOF 8910018076', 'SiS Distribution (Thailand) PLC.', 'MA Thaibev', 2, 'BNDC 4110', NULL, 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, '1234567890', 'Not Assigned', 11, 3, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(133, 'UPDATE', '2026-01-30 11:35:51', 4, 'In Use', 'FGL2314A91P', 'AIR-AP3802I-S-K9 / FGL2314A91P', '4300000581', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, 'Beer Thai', '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(134, 'UPDATE', '2026-01-30 13:22:57', 52, 'In Store', 'AC8BA9D2DAE5', 'UQT-U6-MESH Access point / AC8BA9D2DAE5', '4300000877', '/PR8911008377', 'SiS Distribution (Thailand) PLC.', 'SATHORN1', 2, 'BNDC 4110', '8931007727', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 10, 3, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(135, 'UPDATE', '2026-01-30 13:22:57', 53, 'In Store', 'AC8BA9D2D8DD', 'UQT-U6-MESH Access point / AC8BA9D2D8DD', '4300000884', '/PR8911008377', 'SiS Distribution (Thailand) PLC.', 'SATHORN1', 2, 'BNDC 4110', '8931007727', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 10, 3, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(136, 'UPDATE', '2026-01-30 13:22:57', 56, 'In Store', 'FOC0932Z544', 'Access Switch WS-C2950C-24 / FOC0932Z544', '4300000948', '/Ref SOF 8910018076', 'SiS Distribution (Thailand) PLC.', 'MA Thaibev', 2, 'BNDC 4110', NULL, 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 11, 3, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(137, 'UPDATE', '2026-01-30 13:22:57', 53, 'In Store', 'AC8BA9D2D8DD', 'UQT-U6-MESH Access point / AC8BA9D2D8DD', '4300000884', '/PR8911008377', 'SiS Distribution (Thailand) PLC.', 'SATHORN1', 2, 'BNDC 4110', '8931007727', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'asd', 'Not Assigned', 10, 3, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(138, 'UPDATE', '2026-01-30 13:22:57', 56, 'In Store', 'FOC0932Z544', 'Access Switch WS-C2950C-24 / FOC0932Z544', '4300000948', '/Ref SOF 8910018076', 'SiS Distribution (Thailand) PLC.', 'MA Thaibev', 2, 'BNDC 4110', NULL, 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'asd', 'Not Assigned', 11, 3, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(139, 'UPDATE', '2026-01-30 13:22:57', 52, 'In Store', 'AC8BA9D2DAE5', 'UQT-U6-MESH Access point / AC8BA9D2DAE5', '4300000877', '/PR8911008377', 'SiS Distribution (Thailand) PLC.', 'SATHORN1', 2, 'BNDC 4110', '8931007727', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'asd', 'Not Assigned', 10, 3, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(140, 'UPDATE', '2026-01-30 15:32:03', 56, 'In Use', 'FOC0932Z544', 'Access Switch WS-C2950C-24 / FOC0932Z544', '4300000948', '/Ref SOF 8910018076', 'SiS Distribution (Thailand) PLC.', 'MA Thaibev', 9, 'TCC FL6', NULL, 'Not Assigned', 'Not Assigned', 'asd', NULL, 'asd', 'Not Assigned', 11, 3, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(141, 'UPDATE', '2026-01-30 15:32:47', 57, 'In Use', 'FAB0545W2AD', 'Access Switch WS-C2950C-24 / FAB0545W2AD', '4300000949', '/Ref SOF 8910018076', 'SiS Distribution (Thailand) PLC.', 'MA Thaibev', 1, 'Beer Thai', NULL, 'Not Assigned', 'Not Assigned', '1234567890', NULL, '1234567890', 'Not Assigned', 11, 3, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(142, 'UPDATE', '2026-01-30 15:33:02', 55, 'In Store', 'FAB0545W29X', 'Access Switch WS-C2950C-24 / FAB0545W29X', '4300000947', '/Ref SOF 8910018076', 'SiS Distribution (Thailand) PLC.', 'MA Thaibev', 1, 'Beer Thai', NULL, 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 11, 3, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(143, 'UPDATE', '2026-01-30 15:33:25', 54, 'In Use', 'FOC0821Z2SE', 'Access Switch WS-C2950C-24 / FOC0821Z2SE', '4300000946', '/Ref SOF 8910018076', 'SiS Distribution (Thailand) PLC.', 'MA Thaibev', 1, 'คอสมอส', NULL, 'Not Assigned', 'Not Assigned', '1234567890', NULL, '1234567890', 'Not Assigned', 11, 3, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(144, 'UPDATE', '2026-01-30 15:36:43', 44, 'In Use', 'FGT61FTK20027631', 'FG-61F-BDL-950-36 / FGT61FTK20027631', '4300000001', '8911003902', 'เอ็นทีที (ประเทศไทย)', 'TBL_Wangnoi', 10, 'Wang Noi Ayutaya', '8931003422', 'Not Assigned', '22-04-22', '8910011992', NULL, 'Network as a Service', 'New Installation', 7, 2, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(145, 'UPDATE', '2026-01-30 15:36:43', 45, 'In Use', 'FGT61FTK20028094', 'FG-61F-BDL-950-36 / FGT61FTK20028094', '4300000002', '8911003902', 'เอ็นทีที (ประเทศไทย)', 'TBL_Wangnoi', 10, 'Wang Noi Ayutaya', '8931003422', 'Not Assigned', '22-04-22', '8910011992', NULL, 'Network as a Service', 'New Installation', 7, 2, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(146, 'UPDATE', '2026-02-02 10:15:30', 24, 'In Store', 'FCW2106B5E3', 'WS-C2960X-24PS-L / FCW2106B5E3', '4300000641', '/PR8911007273', 'NETWORK SURE', 'Cosmos', 2, 'BNDC 4110', '8931006625', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 3, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(147, 'UPDATE', '2026-02-02 10:15:30', 54, 'In Store', 'FOC0821Z2SE', 'Access Switch WS-C2950C-24 / FOC0821Z2SE', '4300000946', '/Ref SOF 8910018076', 'SiS Distribution (Thailand) PLC.', 'MA Thaibev', 2, 'BNDC 4110', NULL, 'Not Assigned', 'Not Assigned', '', NULL, '', 'Not Assigned', 11, 3, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(148, 'UPDATE', '2026-02-02 10:15:30', 56, 'In Store', 'FOC0932Z544', 'Access Switch WS-C2950C-24 / FOC0932Z544', '4300000948', '/Ref SOF 8910018076', 'SiS Distribution (Thailand) PLC.', 'MA Thaibev', 2, 'BNDC 4110', NULL, 'Not Assigned', 'Not Assigned', '', NULL, 'asd', 'Not Assigned', 11, 3, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(149, 'UPDATE', '2026-02-02 10:15:30', 24, 'In Store', 'FCW2106B5E3', 'WS-C2960X-24PS-L / FCW2106B5E3', '4300000641', '/PR8911007273', 'NETWORK SURE', 'Cosmos', 2, 'BNDC 4110', '8931006625', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'test', 'Not Assigned', 3, 1, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(150, 'UPDATE', '2026-02-02 10:15:30', 54, 'In Store', 'FOC0821Z2SE', 'Access Switch WS-C2950C-24 / FOC0821Z2SE', '4300000946', '/Ref SOF 8910018076', 'SiS Distribution (Thailand) PLC.', 'MA Thaibev', 2, 'BNDC 4110', NULL, 'Not Assigned', 'Not Assigned', '', NULL, 'test', 'Not Assigned', 11, 3, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel'),
(151, 'UPDATE', '2026-02-02 10:15:30', 56, 'In Store', 'FOC0932Z544', 'Access Switch WS-C2950C-24 / FOC0932Z544', '4300000948', '/Ref SOF 8910018076', 'SiS Distribution (Thailand) PLC.', 'MA Thaibev', 2, 'BNDC 4110', NULL, 'Not Assigned', 'Not Assigned', '', NULL, 'test', 'Not Assigned', 11, 3, '', '2026-01-18', '2026-01-18', '2026-01-19', NULL, NULL, 'Update from Excel');

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
(1, 'switch', 'switch', '#57bee6'),
(2, 'router', 'router', '#7d1b71'),
(3, 'server', 'server', '#e7fd6a');

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
(1, 'AIR-AP3802I-S-K9', 'air-ap3802i-s-k9', 1, 1),
(2, 'AIR-PWRINJ6', 'air-pwrinj6', 1, 1),
(3, 'WS-C2960X-24PS-L', 'ws-c2960x-24ps-l', 1, 1),
(4, 'AIR-AP1852I-E-K9', 'air-ap1852i-e-k9', 1, 1),
(5, 'AIR-AP1852I-S-K9', 'air-ap1852i-s-k9', 1, 1),
(6, 'Easy UPS SRV RM 1000VA Rack', 'easy-ups-srv-rm-1000va-rack', 1, 1),
(7, 'FG-61F-BDL-950-36', 'fg-61f-bdl-950-36', 1, 2),
(8, 'Firewall FortiGate 61F FG-61F', 'firewall-fortigate-61f-fg-61f', 1, 3),
(9, 'Firewall,FG-61F 10xGE RJ45 ports,128GB', 'firewallfg-61f-10xge-rj45-ports128gb', 1, 1),
(10, 'UQT-U6-MESH Access point', 'uqt-u6-mesh-access-point', 1, 4),
(11, 'Access Switch WS-C2950C-24', 'access-switch-ws-c2950c-24', 1, 1);

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
(1, 'Beer Thai', NULL, NULL, 'qweqwe', NULL, NULL),
(2, 'BNDC 4110', NULL, NULL, NULL, NULL, NULL),
(3, 'คอสมอส', NULL, NULL, NULL, NULL, NULL),
(4, 'บริษัท โออิชิ เทรดดิ้ง จำกัด (นวนคร)', NULL, NULL, NULL, NULL, NULL),
(5, 'ศูนย์ย่อยนครสวรรค์', NULL, NULL, NULL, NULL, NULL),
(6, 'ศูนย์ขอนแก่น', NULL, NULL, NULL, NULL, NULL),
(7, 'ศูนย์นครราชสีมา', NULL, NULL, NULL, NULL, NULL),
(8, 'TCC-Private', NULL, NULL, NULL, NULL, NULL),
(9, 'บริษัท คอสมอส บริวเวอรี่ (ประเทศไทย) จำกัด', NULL, NULL, NULL, NULL, NULL),
(10, 'แสงโสม พหลโยธิน Fl.4', NULL, NULL, NULL, NULL, NULL),
(11, 'โรงไฟฟ้าพิจิตร', NULL, NULL, NULL, NULL, NULL),
(12, 'QSNCC', NULL, NULL, NULL, NULL, NULL),
(13, 'ASSC office at CW Tower 5Fl.', NULL, NULL, NULL, NULL, NULL),
(14, 'TCB FL2', NULL, NULL, NULL, NULL, NULL),
(15, 'TCC Private/TCB FL3,TCC8 FL8', NULL, NULL, NULL, NULL, NULL),
(16, 'TCC FL6', NULL, NULL, NULL, NULL, NULL),
(17, 'TCB FL5', NULL, NULL, NULL, NULL, NULL),
(18, 'Silom Edge FL.20 room no.2003-2004', NULL, NULL, NULL, NULL, NULL),
(19, 'Wang Noi Ayutaya', NULL, NULL, NULL, NULL, NULL),
(20, 'อมตะ', NULL, NULL, NULL, NULL, NULL),
(21, 'บ้านบึง', NULL, NULL, NULL, NULL, NULL),
(22, 'วังม่วง', NULL, NULL, NULL, NULL, NULL),
(23, 'SATHORN1', NULL, NULL, NULL, NULL, NULL),
(24, 'Borrowไป SCI', NULL, NULL, NULL, NULL, NULL);

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
(1, 'Cisco', 'cisco'),
(2, 'Fortigate', 'fortigate'),
(3, 'Firewall', 'firewall'),
(4, 'Unifi', 'unifi');

-- --------------------------------------------------------

--
-- Table structure for table `ma_shpm`
--

CREATE TABLE `ma_shpm` (
  `ma_id` int(11) NOT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `device_id` int(11) DEFAULT NULL COMMENT 'FK -> devices(Did)',
  `new_device_id` int(11) DEFAULT NULL,
  `eng_id` int(11) DEFAULT NULL COMMENT 'Engineer (optional FK -> User)',
  `site_id` int(11) DEFAULT NULL COMMENT 'FK -> sites_location(SLid)',
  `contract_id` int(11) DEFAULT NULL COMMENT 'FK -> contract; PM/MA ดึงจาก contract',
  `sla_status` enum('Pass','Fail') DEFAULT NULL COMMENT 'ผ่าน/ตก',
  `travel_how` varchar(255) DEFAULT NULL,
  `travel_cost` int(11) NOT NULL,
  `status` enum('Not Yet','Done') NOT NULL DEFAULT 'Not Yet',
  `file_paths` text DEFAULT NULL COMMENT 'JSON array of file paths',
  `image_paths` text DEFAULT NULL COMMENT 'JSON array of image paths'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
-- Table structure for table `pm_shma`
--

CREATE TABLE `pm_shma` (
  `pm_id` int(11) NOT NULL,
  `start_date` date DEFAULT NULL COMMENT 'เดิน ไป',
  `end_date` date DEFAULT NULL COMMENT 'กลับ',
  `device_id` int(11) DEFAULT NULL COMMENT 'FK -> devices(Did)',
  `site_id` int(11) DEFAULT NULL COMMENT 'FK -> sites_location(SLid)',
  `eng_id` int(11) DEFAULT NULL COMMENT 'Engineer (optional FK -> User)',
  `contract_id` int(11) DEFAULT NULL COMMENT 'FK -> contract; PM/MA ดึงจาก contract',
  `status` varchar(100) DEFAULT NULL COMMENT 'ไม่ชัวร์ เหมือนจะได้ใช้',
  `travel_how` varchar(255) DEFAULT NULL,
  `travel_cost` int(11) NOT NULL,
  `file_paths` text DEFAULT NULL COMMENT 'JSON array of file paths',
  `image_paths` text DEFAULT NULL COMMENT 'JSON array of image paths'
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
(1, 'Thai Beverage Public Company Limited', 'thai-beverage-public-company-limited', 'Active'),
(2, 'บริษัท ที.ซี.ซี.เทคโนโลยี จำกัด Bangna', '---bangna', 'Active'),
(3, 'บริษัท โออิชิ เทรดดิ้ง จำกัด', '---', 'Active'),
(4, 'TEN MOUNTAIN', 'ten-mountain', 'Active'),
(5, 'สุรวงศ์พัฒนา', '', 'Active'),
(6, 'บริษัท ทิพย์พิจิตร ไฮบริดเอนเนอยี่ จำกัด', '---', 'Active'),
(7, 'C A C Co., Ltd', 'c-a-c-co-ltd', 'Active'),
(8, 'บริษัท เอเอสเอ็ม แมนเนจเม้นท์ จำกัด', '---', 'Active'),
(9, 'TCC Private', 'tcc-private', 'Active'),
(10, 'บริษัท ไทยเบฟเวอเรจ โลจิสติก จำกัด (Head Office)', '----head-office', 'Active'),
(11, 'อมตะ', '', 'Active'),
(12, 'บ้านบึง', '', 'Active'),
(13, 'วังม่วง', '', 'Active'),
(14, 'บริษัท โออิชิ เทรดดิ้ง จำกัด (นวนคร)', '----', 'Active'),
(15, 'SATHORN1', 'sathorn1', 'Active'),
(16, 'Borrowไป SCI', 'borrow-sci', 'Active');

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
(1, 1, 1),
(2, 2, 2),
(3, 1, 3),
(4, 3, 4),
(5, 4, 5),
(6, 4, 6),
(7, 4, 7),
(8, 5, 8),
(9, 1, 9),
(10, 1, 10),
(11, 6, 11),
(12, 7, 12),
(13, 8, 13),
(14, 9, 14),
(15, 9, 15),
(16, 9, 16),
(17, 9, 17),
(18, 8, 18),
(19, 10, 19),
(20, 11, 20),
(21, 12, 21),
(22, 13, 22),
(23, 14, 4),
(24, 15, 23),
(25, 16, 24);

-- --------------------------------------------------------

--
-- Table structure for table `tasks`
--

CREATE TABLE `tasks` (
  `id` int(11) NOT NULL,
  `task_type` enum('PM','MA') NOT NULL,
  `contract_id` int(11) DEFAULT NULL,
  `assets` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `replacement_device_id` int(11) DEFAULT NULL,
  `site_id` int(11) DEFAULT NULL,
  `site_name` varchar(255) DEFAULT NULL,
  `vendor_name` varchar(255) DEFAULT NULL,
  `duration` int(11) DEFAULT NULL,
  `sla_term` varchar(255) DEFAULT NULL,
  `coverage_scope` text DEFAULT NULL,
  `priority` varchar(50) DEFAULT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `travel_method` varchar(100) DEFAULT NULL,
  `travel_cost` decimal(12,2) DEFAULT NULL,
  `engineers` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`engineers`)),
  `asset_binding` varchar(255) DEFAULT NULL,
  `status` enum('not-started','working','stuck','done') DEFAULT 'not-started',
  `actually_went` tinyint(1) DEFAULT 0,
  `notes` text DEFAULT NULL,
  `photos` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`photos`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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
-- Dumping data for table `user`
--

INSERT INTO `user` (`User_id`, `Username`, `Password`, `Role`) VALUES
(1, 'testuser', '$argon2id$v=19$m=65536,t=3,p=4$MH7jgZazkUtDmbpgxG5BHw$2Za8dSku1yqn7fsmGfhQR/xb4F4VebxCZz1fyRyaq94', 'Admin');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `contract`
--
ALTER TABLE `contract`
  ADD PRIMARY KEY (`contract_id`),
  ADD KEY `fk_contract_device` (`device_id`),
  ADD KEY `fk_contract_site` (`site_id`);

--
-- Indexes for table `contract_device`
--
ALTER TABLE `contract_device`
  ADD PRIMARY KEY (`contract_id`,`device_id`),
  ADD KEY `fk_cd_device` (`device_id`);

--
-- Indexes for table `contract_site`
--
ALTER TABLE `contract_site`
  ADD PRIMARY KEY (`contract_id`,`SLid`),
  ADD KEY `fk_cs_slid` (`SLid`);

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
-- Indexes for table `ma_shpm`
--
ALTER TABLE `ma_shpm`
  ADD PRIMARY KEY (`ma_id`),
  ADD KEY `fk_ma_device` (`device_id`),
  ADD KEY `fk_ma_site` (`site_id`),
  ADD KEY `fk_ma_contract` (`contract_id`),
  ADD KEY `fk_ma_new_device` (`new_device_id`);

--
-- Indexes for table `netbox`
--
ALTER TABLE `netbox`
  ADD PRIMARY KEY (`Netid`);

--
-- Indexes for table `pm_shma`
--
ALTER TABLE `pm_shma`
  ADD PRIMARY KEY (`pm_id`),
  ADD KEY `fk_pm_device` (`device_id`),
  ADD KEY `fk_pm_site` (`site_id`),
  ADD KEY `fk_pm_contract` (`contract_id`);

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
-- Indexes for table `tasks`
--
ALTER TABLE `tasks`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `user`
--
ALTER TABLE `user`
  ADD PRIMARY KEY (`User_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `contract`
--
ALTER TABLE `contract`
  MODIFY `contract_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

--
-- AUTO_INCREMENT for table `devices`
--
ALTER TABLE `devices`
  MODIFY `Did` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=58;

--
-- AUTO_INCREMENT for table `devices_history`
--
ALTER TABLE `devices_history`
  MODIFY `log_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=152;

--
-- AUTO_INCREMENT for table `device_role`
--
ALTER TABLE `device_role`
  MODIFY `DeRoleid` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `device_type`
--
ALTER TABLE `device_type`
  MODIFY `Dtypeid` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `location`
--
ALTER TABLE `location`
  MODIFY `lid` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

--
-- AUTO_INCREMENT for table `manufacturer`
--
ALTER TABLE `manufacturer`
  MODIFY `Mid` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `ma_shpm`
--
ALTER TABLE `ma_shpm`
  MODIFY `ma_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `netbox`
--
ALTER TABLE `netbox`
  MODIFY `Netid` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `pm_shma`
--
ALTER TABLE `pm_shma`
  MODIFY `pm_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `sites`
--
ALTER TABLE `sites`
  MODIFY `Sid` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `sites_location`
--
ALTER TABLE `sites_location`
  MODIFY `SLid` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=26;

--
-- AUTO_INCREMENT for table `tasks`
--
ALTER TABLE `tasks`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT for table `user`
--
ALTER TABLE `user`
  MODIFY `User_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `contract`
--
ALTER TABLE `contract`
  ADD CONSTRAINT `fk_contract_device` FOREIGN KEY (`device_id`) REFERENCES `devices` (`Did`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_contract_site` FOREIGN KEY (`site_id`) REFERENCES `sites_location` (`SLid`) ON DELETE SET NULL;

--
-- Constraints for table `contract_device`
--
ALTER TABLE `contract_device`
  ADD CONSTRAINT `fk_cd_contract` FOREIGN KEY (`contract_id`) REFERENCES `contract` (`contract_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_cd_device` FOREIGN KEY (`device_id`) REFERENCES `devices` (`Did`) ON DELETE CASCADE;

--
-- Constraints for table `contract_site`
--
ALTER TABLE `contract_site`
  ADD CONSTRAINT `fk_cs_contract` FOREIGN KEY (`contract_id`) REFERENCES `contract` (`contract_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_cs_slid` FOREIGN KEY (`SLid`) REFERENCES `sites_location` (`SLid`) ON DELETE CASCADE;

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
-- Constraints for table `ma_shpm`
--
ALTER TABLE `ma_shpm`
  ADD CONSTRAINT `fk_ma_contract` FOREIGN KEY (`contract_id`) REFERENCES `contract` (`contract_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_ma_device` FOREIGN KEY (`device_id`) REFERENCES `devices` (`Did`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_ma_new_device` FOREIGN KEY (`new_device_id`) REFERENCES `devices` (`Did`),
  ADD CONSTRAINT `fk_ma_site` FOREIGN KEY (`site_id`) REFERENCES `sites_location` (`SLid`) ON DELETE SET NULL;

--
-- Constraints for table `pm_shma`
--
ALTER TABLE `pm_shma`
  ADD CONSTRAINT `fk_pm_contract` FOREIGN KEY (`contract_id`) REFERENCES `contract` (`contract_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_pm_device` FOREIGN KEY (`device_id`) REFERENCES `devices` (`Did`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_pm_site` FOREIGN KEY (`site_id`) REFERENCES `sites_location` (`SLid`) ON DELETE SET NULL;

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
