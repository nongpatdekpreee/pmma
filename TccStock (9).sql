-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: db:3306
-- Generation Time: Jan 20, 2026 at 02:57 AM
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
-- Dumping data for table `Devices`
--

INSERT INTO `Devices` (`Did`, `Asset_State`, `serial`, `CI_Name`, `Asset_Number`, `PR_No`, `Vendor`, `Project_purchase`, `SLid`, `PO_No`, `Loan_Start`, `Request_Date`, `Refer_SOF`, `Refer_Ticket`, `Assigned_Service`, `Reason`, `Dtypeid`, `DeRoleid`, `Project_code_purchase`, `Waranty_start`, `Waranty_end`, `Received_date`, `Asset_Type`, `Owner`) VALUES
(1, 'In Use', 'FGL2314A91L', 'AIR-AP3802I-S-K9 / FGL2314A91L', '4300000627', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(2, 'In Use', 'FGL2314A91M', 'AIR-AP3802I-S-K9 / FGL2314A91M', '4300000579', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(3, 'In Use', 'FGL2314A91N', 'AIR-AP3802I-S-K9 / FGL2314A91N', '4300000580', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(4, 'In Use', 'FGL2314A91P', 'AIR-AP3802I-S-K9 / FGL2314A91P', '4300000581', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(5, 'In Use', 'FGL2314A91Q', 'AIR-AP3802I-S-K9 / FGL2314A91Q', '4300000582', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(6, 'In Use', 'FGL2314A91R', 'AIR-AP3802I-S-K9 / FGL2314A91R', '4300000583', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(7, 'In Use', 'FGL2314A91S', 'AIR-AP3802I-S-K9 / FGL2314A91S', '4300000584', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(8, 'In Use', 'FGL2314A91T', 'AIR-AP3802I-S-K9 / FGL2314A91T', '4300000585', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(9, 'In Use', 'FGL2314A91U', 'AIR-AP3802I-S-K9 / FGL2314A91U', '4300000586', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(10, 'In Use', 'FGL2314A91V', 'AIR-AP3802I-S-K9 / FGL2314A91V', '4300000587', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(11, 'In Use', 'FGL2314A91W', 'AIR-AP3802I-S-K9 / FGL2314A91W', '4300000588', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 1, '8931006623', 'Not Assigned', '29-09-23', '8910019553', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(12, 'In Store', 'FGL2314A92D', 'AIR-AP3802I-S-K9 / FGL2314A92D', '4300000594', '/PR8911007272', 'NETWORK SURE', 'บริษัท เบียร์ไทย (1991) จำกัด (มหาชน)', 2, '8931006623', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(13, 'In Use', 'FGL2322A8BU', 'AIR-AP3802I-S-K9 / FGL2322A8BU', '4300000628', '/PR8911007273', 'NETWORK SURE', 'Cosmos', 3, '8931006625', 'Not Assigned', '21-09-2023', '8910019218', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(14, 'In Use', 'FGL2322A8BV', 'AIR-AP3802I-S-K9 / FGL2322A8BV', '4300000629', '/PR8911007273', 'NETWORK SURE', 'Cosmos', 3, '8931006625', 'Not Assigned', '21-09-2023', '8910019218', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(15, 'Waiting to sell', 'FGL2322A8BY', 'AIR-AP3802I-S-K9 / FGL2322A8BY', '4300000630', '/PR8911007273', 'NETWORK SURE', 'Cosmos', 3, '8931006625', 'Not Assigned', '21-09-2023', '8910019218', NULL, 'Not Assigned', 'Not Assigned', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(16, 'In Use', 'FGL2322A8D0', 'AIR-AP3802I-S-K9 / FGL2322A8D0', '4300000631', '/PR8911007273', 'NETWORK SURE', 'Cosmos', 3, '8931006625', 'Not Assigned', '21-09-2023', '8910019218', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(17, 'In Use', 'FGL2322A8D1', 'AIR-AP3802I-S-K9 / FGL2322A8D1', '4300000632', '/PR8911007273', 'NETWORK SURE', 'Cosmos', 3, '8931006625', 'Not Assigned', '21-09-2023', '8910019218', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(18, 'In Use', 'FGL2322A8D2', 'AIR-AP3802I-S-K9 / FGL2322A8D2', '4300000633', '/PR8911007273', 'NETWORK SURE', 'Cosmos', 3, '8931006625', 'Not Assigned', '21-09-2023', '8910019218', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(19, 'In Use', 'C17366663000006171', 'AIR-PWRINJ6 / C17366663000006171', '4300000615', '/PR8911007271', 'NETWORK SURE', 'Beerthip Bang Ban', 4, '8931006624', 'Not Assigned', '14-ต.ค.-25', '8910018077', NULL, 'Device Network Manage Service', 'Replacement', 2, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(20, 'In Store', 'PHI2326015W', 'AIR-PWRINJ6 / PHI2326015W', '4300000620', '/PR8911007271', 'NETWORK SURE', 'Beerthip Bang Ban', 2, '8931006624', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 2, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(21, 'In Use', 'FGL2322A8DL', 'AIR-AP3802I-S-K9 / FGL2322A8DL', '4300000636', '/PR8911007273', 'NETWORK SURE', 'Cosmos', 3, '8931006625', 'Not Assigned', '21-09-2023', '8910019218', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(22, 'In Use', 'FGL2322A8DM', 'AIR-AP3802I-S-K9 / FGL2322A8DM', '4300000637', '/PR8911007273', 'NETWORK SURE', 'Cosmos', 3, '8931006625', 'Not Assigned', '21-09-2023', '8910019218', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(23, 'Waiting to sell', 'FGL2322A8DQ', 'AIR-AP3802I-S-K9 / FGL2322A8DQ', '4300000638', '/PR8911007273', 'NETWORK SURE', 'Cosmos', 3, '8931006625', 'Not Assigned', '21-09-2023', '8910019218', NULL, 'Network as a Service', 'New Installation', 1, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(24, 'In Store', 'FCW2106B5E3', 'WS-C2960X-24PS-L / FCW2106B5E3', '4300000641', '/PR8911007273', 'NETWORK SURE', 'Cosmos', 2, '8931006625', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 3, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(25, 'In Store On Site', 'KWC24230DGM', 'AIR-AP1852I-E-K9 / KWC24230DGM', '4300000360', '8911006695', 'NETWORK SURE', 'MA Thaibev', 5, '8931006091', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 4, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(26, 'In Store On Site', 'KWC24230DGN', 'AIR-AP1852I-E-K9 / KWC24230DGN', '4300000361', '8911006695', 'NETWORK SURE', 'MA Thaibev', 6, '8931006091', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 4, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(27, 'In Store On Site', 'KWC24230DGS', 'AIR-AP1852I-E-K9 / KWC24230DGS', '4300000362', '8911006695', 'NETWORK SURE', 'MA Thaibev', 7, '8931006091', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 4, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(28, 'In Use', 'KWC24230DGZ', 'AIR-AP1852I-E-K9 / KWC24230DGZ', '4300000363', '8911006695', 'NETWORK SURE', 'MA Thaibev', 8, '8931006091', 'Not Assigned', '21-พ.ค.-24', '8910018437', NULL, 'Device Network Rental Service', 'Replacement', 4, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(29, 'Waiting to sell', 'KWC210607J0', 'AIR-AP1852I-S-K9 / KWC210607J0', '4200022757', '8911005365', 'NETWORK SURE', 'บริษัท ทิพย์พิจิตร ไฮบริดเอนเนอยี่ จำกัด', 9, '8931004691', 'Not Assigned', '30-03-23', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 5, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(30, 'In Use', 'KWC2135031K', 'AIR-AP1852I-S-K9 / KWC2135031K', '4200022757', '8911006857', 'NETWORK SURE', 'MA Thaibev', 10, '8931006149', 'Not Assigned', '16-06-23', 'Not Assigned', NULL, 'Device Network Manage Service', 'Replacement', 5, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(31, 'In Use', 'KWC214705XW', 'AIR-AP1852I-S-K9 / KWC214705XW', '4300000344', '8911006857', 'NETWORK SURE', 'MA Thaibev', 11, '8931006149', 'Not Assigned', '6-พ.ย.-23', 'Not Assigned', NULL, 'Network as a Service', 'Replacement', 5, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(32, 'Waiting to sell', 'KWC214705ZL', 'AIR-AP1852I-S-K9 / KWC214705ZL', '4300000045', '8911005365', 'NETWORK SURE', 'บริษัท ทิพย์พิจิตร ไฮบริดเอนเนอยี่ จำกัด', 11, '8931004691', 'Not Assigned', '9-พ.ค.-22', '8910014954', NULL, 'Not Assigned', 'Not Assigned', 5, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(33, 'In Use', 'KWC214705ZX', 'AIR-AP1852I-S-K9 / KWC214705ZX', '4300000046', '8911005365', 'NETWORK SURE', 'บริษัท ทิพย์พิจิตร ไฮบริดเอนเนอยี่ จำกัด', 11, '8931004691', 'Not Assigned', '9-พ.ค.-22', '8910014954', NULL, 'Network as a Service', 'New Installation', 5, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(34, 'In Use', 'KWC214901DK', 'AIR-AP1852I-S-K9 / KWC214901DK', '4300000109', '8911005825', 'NETWORK SURE', 'C A C Co., Ltd', 12, '8931005120', 'Not Assigned', '31-10-22', '8910016691', NULL, 'Not Assigned', 'Not Assigned', 5, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(35, 'In Use', 'KWC222803UY', 'AIR-AP1852I-S-K9 / KWC222803UY', '4300000530', '8911007225', 'NETWORK SURE', 'Cyber World Bldg.', 13, '8931006527', 'Not Assigned', '7-ส.ค.-23', '8910019823', NULL, 'Not Assigned', 'Not Assigned', 5, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(36, 'In Use', 'KWC222803ZU', 'AIR-AP1852I-S-K9 / KWC222803ZU', '4300000531', '8911007225', 'NETWORK SURE', 'Cyber World Bldg.', 13, '8931006527', 'Not Assigned', '7-ส.ค.-23', '8910019823', NULL, 'Not Assigned', 'Not Assigned', 5, 1, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(37, 'In Use', 'KWC22290C2Y', 'AIR-AP1852I-S-K9 / KWC22290C2Y', '4300000176', '8911006660', 'Network Sure', 'Surawong AP Rental', 14, '8931005955', 'Not Assigned', '25-03-23', '8910018437', NULL, 'Device Network Rental Service', 'New Installation', 5, 2, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(38, 'In Use', 'KWC2447074U', 'AIR-AP1852I-S-K9 / KWC2447074U', '4300000177', '8911006660', 'Network Sure', 'Surawong AP Rental', 15, '8931005955', 'Not Assigned', '7-ส.ค.-24', '8910020956', NULL, 'Not Assigned', 'Not Assigned', 5, 2, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(39, 'In Use', 'KWC2230004B', 'AIR-AP1852I-S-K9 / KWC2230004B', '4300000532', '8911007225', 'NETWORK SURE', 'Cyber World Bldg.', 13, '8931006527', 'Not Assigned', '7-ส.ค.-23', '8910019823', NULL, 'Not Assigned', 'Not Assigned', 5, 2, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(40, 'In Use', 'KWC223205F7', 'AIR-AP1852I-S-K9 / KWC223205F7', '4300000178', '8911006660', 'Network Sure', 'Surawong AP Rental', 16, '8931005955', 'Not Assigned', '25-03-23', '8910017548', NULL, 'Not Assigned', 'Not Assigned', 5, 2, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(41, 'In Use', 'KWC223206E0', 'AIR-AP1852I-S-K9 / KWC223206E0', '4300000179', '8911006660', 'Network Sure', 'Surawong AP Rental', 17, '8931005955', 'Not Assigned', '25-03-23', '8910018437', NULL, 'Device Network Rental Service', 'New Installation', 5, 2, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(42, 'In Use', 'KWC223208C5', 'AIR-AP1852I-S-K9 / KWC223208C5', '4300000345', '8911006857', 'NETWORK SURE', 'MA Thaibev', 11, '8931006149', 'Not Assigned', '22-05-23', 'Not Assigned', NULL, 'Network as a Service', 'Replacement', 5, 2, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(43, 'In Use', 'UPS01', 'Easy UPS SRV RM 1000VA Rack / UPS01', '4300000670', 'PR8911007855', 'เวเปอร์ เทค จำกัด', 'ASMM Silom Edge 20th Fl.', 18, '8931007223', 'Not Assigned', '22-ต.ค.-23', '8910021263', NULL, 'Network as a Service', 'New Installation', 6, 2, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(44, 'In Use', 'FGT61FTK20027631', 'FG-61F-BDL-950-36 / FGT61FTK20027631', '4300000001', '8911003902', 'เอ็นทีที (ประเทศไทย)', 'TBL_Wangnoi', 19, '8931003422', 'Not Assigned', '22-04-22', '8910011992', NULL, 'Network as a Service', 'New Installation', 7, 2, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(45, 'In Use', 'FGT61FTK20028094', 'FG-61F-BDL-950-36 / FGT61FTK20028094', '4300000002', '8911003902', 'เอ็นทีที (ประเทศไทย)', 'TBL_Wangnoi', 19, '8931003422', 'Not Assigned', '22-04-22', '8910011992', NULL, 'Network as a Service', 'New Installation', 7, 2, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(46, 'In Use', 'FGT61FTK23003621', 'Firewall FortiGate 61F FG-61F / FGT61FTK23003621', '4200026511', NULL, 'เอ็นทีที (ประเทศไทย)', 'บริษัท โออิชิ เทรดดิ้ง จำกัด', 20, '8931007187', 'Not Assigned', '23/11/23', 'Not Assigned', NULL, 'Network as a Service', 'New Installation', 8, 3, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(47, 'In Use', 'FGT61FTK23003917', 'Firewall FortiGate 61F FG-61F / FGT61FTK23003917', '4200026510', NULL, 'เอ็นทีที (ประเทศไทย)', 'บริษัท โออิชิ เทรดดิ้ง จำกัด', 21, '8931007186', 'Not Assigned', '23/11/23', 'Not Assigned', NULL, 'Network as a Service', 'New Installation', 8, 3, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(48, 'In Use', 'FGT61FTK23004452', 'Firewall FortiGate 61F FG-61F / FGT61FTK23004452', '4200026512', NULL, 'เอ็นทีที (ประเทศไทย)', 'บริษัท โออิชิ เทรดดิ้ง จำกัด', 22, '8931007188', 'Not Assigned', '23/11/23', 'Not Assigned', NULL, 'Network as a Service', 'New Installation', 8, 3, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(49, 'In Use', 'FGT61FTK22063593', 'Firewall,FG-61F 10xGE RJ45 ports,128GB / FGT61FTK22063593', '4300000473', '8911006833', 'ทรานซิสชั่น ซิสเต็มส์ แอนด์ เน็ทเวอร์คส', 'Project ASSC : [ThaiBev-SilomEdge]', 23, '8931006111', 'Not Assigned', 'Not Assigned', '8910018855', NULL, 'Network as a Service', 'New Installation', 9, 3, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(50, 'In Use', 'AC8BA9D33B6D', 'UQT-U6-MESH Access point / AC8BA9D33B6D', '4300000889', '/PR8911008377', 'SiS Distribution (Thailand) PLC.', 'SATHORN1', 24, '8931007727', 'Not Assigned', '15-ม.ค.-24', 'รอ SOF', NULL, 'Network as a Service', 'New Installation', 10, 3, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(51, 'In Use', 'AC8BA9D32875', 'UQT-U6-MESH Access point / AC8BA9D32875', '4300000874', '/PR8911008377', 'SiS Distribution (Thailand) PLC.', 'SATHORN1', 2, '8931007727', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 10, 3, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(52, 'In Use', 'AC8BA9D2DAE5', 'UQT-U6-MESH Access point / AC8BA9D2DAE5', '4300000877', '/PR8911008377', 'SiS Distribution (Thailand) PLC.', 'SATHORN1', 2, '8931007727', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 10, 3, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(53, 'In Use', 'AC8BA9D2D8DD', 'UQT-U6-MESH Access point / AC8BA9D2D8DD', '4300000884', '/PR8911008377', 'SiS Distribution (Thailand) PLC.', 'SATHORN1', 25, '8931007727', 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 10, 3, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(54, 'In Use', 'FOC0821Z2SE', 'Access Switch WS-C2950C-24 / FOC0821Z2SE', '4300000946', '/Ref SOF 8910018076', 'SiS Distribution (Thailand) PLC.', 'MA Thaibev', 2, NULL, 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 11, 3, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(55, 'In Use', 'FAB0545W29X', 'Access Switch WS-C2950C-24 / FAB0545W29X', '4300000947', '/Ref SOF 8910018076', 'SiS Distribution (Thailand) PLC.', 'MA Thaibev', 2, NULL, 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 11, 3, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(56, 'In Use', 'FOC0932Z544', 'Access Switch WS-C2950C-24 / FOC0932Z544', '4300000948', '/Ref SOF 8910018076', 'SiS Distribution (Thailand) PLC.', 'MA Thaibev', 2, NULL, 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 11, 3, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL),
(57, 'In Use', 'FAB0545W2AD', 'Access Switch WS-C2950C-24 / FAB0545W2AD', '4300000949', '/Ref SOF 8910018076', 'SiS Distribution (Thailand) PLC.', 'MA Thaibev', 2, NULL, 'Not Assigned', 'Not Assigned', 'Not Assigned', NULL, 'Not Assigned', 'Not Assigned', 11, 3, '', '2026-01-18', '2026-01-18', '2026-01-18 17:55:41', NULL, NULL);

--
-- Triggers `Devices`
--
DELIMITER $$
CREATE TRIGGER `trg_devices_insert` AFTER INSERT ON `Devices` FOR EACH ROW BEGIN
    DECLARE v_sid INT DEFAULT NULL;
    DECLARE v_location2 VARCHAR(255) DEFAULT NULL;

    -- Get Sid and Location2 from SLid
    IF NEW.SLid IS NOT NULL THEN
        SELECT SL.Sid, L.Location2
        INTO v_sid, v_location2
        FROM Sites_Location SL
        JOIN Location L ON SL.lid = L.lid
        WHERE SL.SLid = NEW.SLid
        LIMIT 1;
    END IF;

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
CREATE TRIGGER `trg_devices_update` AFTER UPDATE ON `Devices` FOR EACH ROW BEGIN
    DECLARE v_sid INT DEFAULT NULL;
    DECLARE v_location2 VARCHAR(255) DEFAULT NULL;

    -- Get Sid and Location2 from SLid (use OLD.SLid for history)
    IF OLD.SLid IS NOT NULL THEN
        SELECT SL.Sid, L.Location2
        INTO v_sid, v_location2
        FROM Sites_Location SL
        JOIN Location L ON SL.lid = L.lid
        WHERE SL.SLid = OLD.SLid
        LIMIT 1;
    END IF;

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
-- Table structure for table `Devices_History`
--

CREATE TABLE `Devices_History` (
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
-- Dumping data for table `Devices_History`
--

INSERT INTO `Devices_History` (`log_id`, `action_type`, `changed_at`, `Did`, `Asset_State`, `serial`, `CI_Name`, `Asset_Number`, `PR_No`, `Vendor`, `Project_purchase`, `Sid`, `Location2`, `PO_No`, `Loan_Start`, `Request_Date`, `Refer_SOF`, `Refer_Ticket`, `Assigned_Service`, `Reason`, `Dtypeid`, `DeRoleid`, `Project_code_purchase`, `Waranty_start`, `Waranty_end`, `Received_date`, `Asset_Type`, `Owner`, `Description`) VALUES
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
(71, 'UPDATE', '2026-01-18 18:00:53', 34, 'Waiting to sell', 'KWC214901DK', 'AIR-AP1852I-S-K9 / KWC214901DK', '4300000109', '8911005825', 'NETWORK SURE', 'C A C Co., Ltd', 7, 'QSNCC', '8931005120', 'Not Assigned', '31-10-22', '8910016691', NULL, 'Not Assigned', 'Not Assigned', 5, 1, '', '2026-01-18', '2026-01-18', '2026-01-18', NULL, NULL, 'AAA');

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

--
-- Dumping data for table `Device_Role`
--

INSERT INTO `Device_Role` (`DeRoleid`, `name`, `slug`, `color`) VALUES
(1, 'switch', 'switch', '#57bee6'),
(2, 'router', 'router', '#7d1b71'),
(3, 'server', 'server', '#e7fd6a');

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

--
-- Dumping data for table `Device_Type`
--

INSERT INTO `Device_Type` (`Dtypeid`, `model`, `slug`, `u_height`, `Mid`) VALUES
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
-- Table structure for table `Location`
--

CREATE TABLE `Location` (
  `lid` int(11) NOT NULL,
  `Location2` varchar(255) NOT NULL,
  `District` varchar(100) DEFAULT NULL,
  `Subdistrict` varchar(100) DEFAULT NULL,
  `Province` varchar(100) DEFAULT NULL,
  `Address_code` varchar(100) DEFAULT NULL,
  `Description` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `Location`
--

INSERT INTO `Location` (`lid`, `Location2`, `District`, `Subdistrict`, `Province`, `Address_code`, `Description`) VALUES
(1, 'Beer Thai', NULL, NULL, NULL, NULL, NULL),
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
-- Table structure for table `Manufacturer`
--

CREATE TABLE `Manufacturer` (
  `Mid` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `slug` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `Manufacturer`
--

INSERT INTO `Manufacturer` (`Mid`, `name`, `slug`) VALUES
(1, 'Cisco', 'cisco'),
(2, 'Fortigate', 'fortigate'),
(3, 'Firewall', 'firewall'),
(4, 'Unifi', 'unifi');

-- --------------------------------------------------------

--
-- Table structure for table `Netbox`
--

CREATE TABLE `Netbox` (
  `Netid` int(11) NOT NULL,
  `Token` varchar(255) NOT NULL,
  `Server` varchar(255) NOT NULL
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

--
-- Dumping data for table `Sites`
--

INSERT INTO `Sites` (`Sid`, `Name`, `Slug`, `Status`) VALUES
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
-- Table structure for table `Sites_Location`
--

CREATE TABLE `Sites_Location` (
  `SLid` int(11) NOT NULL,
  `Sid` int(11) NOT NULL,
  `lid` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `Sites_Location`
--

INSERT INTO `Sites_Location` (`SLid`, `Sid`, `lid`) VALUES
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
-- Table structure for table `User`
--

CREATE TABLE `User` (
  `User_id` int(11) NOT NULL,
  `Username` varchar(255) NOT NULL,
  `Password` varchar(255) NOT NULL,
  `Role` enum('User','Admin') NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `User`
--

INSERT INTO `User` (`User_id`, `Username`, `Password`, `Role`) VALUES
(1, 'testuser', '$argon2id$v=19$m=65536,t=3,p=4$MH7jgZazkUtDmbpgxG5BHw$2Za8dSku1yqn7fsmGfhQR/xb4F4VebxCZz1fyRyaq94', 'Admin');

-- --------------------------------------------------------

--
-- Table structure for table `contract`
--

CREATE TABLE `contract` (
  `contract_id` int(11) NOT NULL AUTO_INCREMENT,
  `contract_name` varchar(255) DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `device_id` int(11) DEFAULT NULL COMMENT 'FK -> Devices(Did)',
  `site_id` int(11) DEFAULT NULL COMMENT 'FK -> Sites_Location(SLid)',
  `sof_name` varchar(255) DEFAULT NULL,
  `sla_name` varchar(255) NOT NULL,
  `sla_detail` varchar(255) NOT NULL COMMENT 'เช่น ระยะเวลาการตอบกลับ 24/7',
  `sale_account` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`contract_id`),
  KEY `fk_contract_device` (`device_id`),
  KEY `fk_contract_site` (`site_id`),
  CONSTRAINT `fk_contract_device` FOREIGN KEY (`device_id`) REFERENCES `Devices` (`Did`) ON DELETE SET NULL,
  CONSTRAINT `fk_contract_site` FOREIGN KEY (`site_id`) REFERENCES `Sites_Location` (`SLid`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ma_shpm`
--

CREATE TABLE `ma_shpm` (
  `ma_id` int(11) NOT NULL AUTO_INCREMENT,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `device_id` int(11) DEFAULT NULL COMMENT 'FK -> Devices(Did)',
  `eng_id` int(11) DEFAULT NULL COMMENT 'Engineer (optional FK -> User)',
  `site_id` int(11) DEFAULT NULL COMMENT 'FK -> Sites_Location(SLid)',
  `contract_id` int(11) DEFAULT NULL COMMENT 'FK -> contract; PM/MA ดึงจาก contract',
  `sla_status` enum('Pass','Fail') DEFAULT NULL COMMENT 'ผ่าน/ตก',
  `travel_how` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ma_id`),
  KEY `fk_ma_device` (`device_id`),
  KEY `fk_ma_site` (`site_id`),
  KEY `fk_ma_contract` (`contract_id`),
  CONSTRAINT `fk_ma_device` FOREIGN KEY (`device_id`) REFERENCES `Devices` (`Did`) ON DELETE SET NULL,
  CONSTRAINT `fk_ma_site` FOREIGN KEY (`site_id`) REFERENCES `Sites_Location` (`SLid`) ON DELETE SET NULL,
  CONSTRAINT `fk_ma_contract` FOREIGN KEY (`contract_id`) REFERENCES `contract` (`contract_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `pm_shma`
--

CREATE TABLE `pm_shma` (
  `pm_id` int(11) NOT NULL AUTO_INCREMENT,
  `start_date` date DEFAULT NULL COMMENT 'เดิน ไป',
  `end_date` date DEFAULT NULL COMMENT 'กลับ',
  `device_id` int(11) DEFAULT NULL COMMENT 'FK -> Devices(Did)',
  `site_id` int(11) DEFAULT NULL COMMENT 'FK -> Sites_Location(SLid)',
  `eng_id` int(11) DEFAULT NULL COMMENT 'Engineer (optional FK -> User)',
  `contract_id` int(11) DEFAULT NULL COMMENT 'FK -> contract; PM/MA ดึงจาก contract',
  `status` varchar(100) DEFAULT NULL COMMENT 'ไม่ชัวร์ เหมือนจะได้ใช้',
  `travel_how` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`pm_id`),
  KEY `fk_pm_device` (`device_id`),
  KEY `fk_pm_site` (`site_id`),
  KEY `fk_pm_contract` (`contract_id`),
  CONSTRAINT `fk_pm_device` FOREIGN KEY (`device_id`) REFERENCES `Devices` (`Did`) ON DELETE SET NULL,
  CONSTRAINT `fk_pm_site` FOREIGN KEY (`site_id`) REFERENCES `Sites_Location` (`SLid`) ON DELETE SET NULL,
  CONSTRAINT `fk_pm_contract` FOREIGN KEY (`contract_id`) REFERENCES `contract` (`contract_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `contract_device`
--

CREATE TABLE IF NOT EXISTS `contract_device` (
  `contract_id` int(11) NOT NULL,
  `device_id` int(11) NOT NULL,
  PRIMARY KEY (`contract_id`, `device_id`),
  KEY `fk_cd_device` (`device_id`),
  CONSTRAINT `fk_cd_contract` FOREIGN KEY (`contract_id`) REFERENCES `contract` (`contract_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cd_device` FOREIGN KEY (`device_id`) REFERENCES `Devices` (`Did`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Indexes for dumped tables
--

--
-- Indexes for table `Devices`
--
ALTER TABLE `Devices`
  ADD PRIMARY KEY (`Did`),
  ADD KEY `frk1` (`Dtypeid`),
  ADD KEY `frk2` (`SLid`),
  ADD KEY `frk3` (`DeRoleid`);

--
-- Indexes for table `Devices_History`
--
ALTER TABLE `Devices_History`
  ADD PRIMARY KEY (`log_id`);

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
-- Indexes for table `Location`
--
ALTER TABLE `Location`
  ADD PRIMARY KEY (`lid`);

--
-- Indexes for table `Manufacturer`
--
ALTER TABLE `Manufacturer`
  ADD PRIMARY KEY (`Mid`);

--
-- Indexes for table `Netbox`
--
ALTER TABLE `Netbox`
  ADD PRIMARY KEY (`Netid`);

--
-- Indexes for table `Sites`
--
ALTER TABLE `Sites`
  ADD PRIMARY KEY (`Sid`);

--
-- Indexes for table `Sites_Location`
--
ALTER TABLE `Sites_Location`
  ADD PRIMARY KEY (`SLid`),
  ADD KEY `frk11` (`Sid`),
  ADD KEY `frk12` (`lid`);

--
-- Indexes for table `User`
--
ALTER TABLE `User`
  ADD PRIMARY KEY (`User_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `Devices`
--
ALTER TABLE `Devices`
  MODIFY `Did` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=58;

--
-- AUTO_INCREMENT for table `Devices_History`
--
ALTER TABLE `Devices_History`
  MODIFY `log_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=72;

--
-- AUTO_INCREMENT for table `Device_Role`
--
ALTER TABLE `Device_Role`
  MODIFY `DeRoleid` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `Device_Type`
--
ALTER TABLE `Device_Type`
  MODIFY `Dtypeid` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `Location`
--
ALTER TABLE `Location`
  MODIFY `lid` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

--
-- AUTO_INCREMENT for table `Manufacturer`
--
ALTER TABLE `Manufacturer`
  MODIFY `Mid` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `Netbox`
--
ALTER TABLE `Netbox`
  MODIFY `Netid` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `Sites`
--
ALTER TABLE `Sites`
  MODIFY `Sid` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `Sites_Location`
--
ALTER TABLE `Sites_Location`
  MODIFY `SLid` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=26;

--
-- AUTO_INCREMENT for table `User`
--
ALTER TABLE `User`
  MODIFY `User_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `contract`
--
ALTER TABLE `contract`
  MODIFY `contract_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `ma_shpm`
--
ALTER TABLE `ma_shpm`
  MODIFY `ma_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `pm_shma`
--
ALTER TABLE `pm_shma`
  MODIFY `pm_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `Devices`
--
ALTER TABLE `Devices`
  ADD CONSTRAINT `frk1` FOREIGN KEY (`Dtypeid`) REFERENCES `Device_Type` (`Dtypeid`),
  ADD CONSTRAINT `frk3` FOREIGN KEY (`DeRoleid`) REFERENCES `Device_Role` (`DeRoleid`),
  ADD CONSTRAINT `frk4` FOREIGN KEY (`SLid`) REFERENCES `Sites_Location` (`SLid`);

--
-- Constraints for table `Device_Type`
--
ALTER TABLE `Device_Type`
  ADD CONSTRAINT `frk_type1` FOREIGN KEY (`Mid`) REFERENCES `Manufacturer` (`Mid`);

--
-- Constraints for table `Sites_Location`
--
ALTER TABLE `Sites_Location`
  ADD CONSTRAINT `frk11` FOREIGN KEY (`Sid`) REFERENCES `Sites` (`Sid`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `frk12` FOREIGN KEY (`lid`) REFERENCES `Location` (`lid`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
