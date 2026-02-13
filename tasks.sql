-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: db:3306
-- Generation Time: Feb 12, 2026 at 03:43 AM
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
  `sla_term` varchar(255) DEFAULT NULL,
  `coverage_scope` text DEFAULT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `engineers` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`engineers`)),
  `asset_binding` varchar(255) DEFAULT NULL,
  `status` enum('not-started','working','stuck','done') DEFAULT 'not-started',
  `actually_went` tinyint(1) DEFAULT 0,
  `notes` text DEFAULT NULL,
  `photos` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`photos`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tasks`
--

INSERT INTO `tasks` (`id`, `task_type`, `contract_id`, `assets`, `replacement_device_id`, `site_id`, `site_name`, `vendor_name`, `sla_term`, `coverage_scope`, `start_date`, `end_date`, `engineers`, `asset_binding`, `status`, `actually_went`, `notes`, `photos`, `created_at`, `updated_at`) VALUES
(1, 'PM', 1, '[{\"id\":1,\"name\":\"AIR-AP3802I-S-K9 / FGL2314A91L\",\"Dtypeid\":2,\"DeRoleid\":3,\"type\":\"Device\",\"serialNumber\":\"FGL2314A91L\",\"site\":\"Thai Beverage Public Company Limited\",\"assetState\":\"In Use\",\"assetNumber\":\"4300000627\",\"source\":\"site\",\"SLid\":1,\"role\":\"server\",\"manufacturer\":\"Cisco\",\"model\":\"AIR-PWRINJ6\"},{\"id\":3,\"name\":\"AIR-AP3802I-S-K9 / FGL2314A91N\",\"Dtypeid\":3,\"DeRoleid\":2,\"type\":\"Device\",\"serialNumber\":\"FGL2314A91N\",\"site\":\"Thai Beverage Public Company Limited\",\"assetState\":\"In Use\",\"assetNumber\":\"4300000580\",\"source\":\"site\",\"SLid\":1,\"role\":\"router\",\"manufacturer\":\"Cisco\",\"model\":\"WS-C2960X-24PS-L\"}]', NULL, 1, 'Thai Beverage Public Company Limited - Beer Thai', NULL, NULL, '\nี', '2026-02-20', '2026-02-20', '[{\"id\":\"9\",\"name\":\"Chainarin\",\"lastName\":\"Phosai (โบ๊ท)\"}]', NULL, 'not-started', 0, 'ง่าวงงววแง่งงง', NULL, '2026-02-11 04:36:48', '2026-02-11 08:44:12'),
(2, 'PM', 1, '[{\"id\":1,\"name\":\"AIR-AP3802I-S-K9 / FGL2314A91L\",\"Dtypeid\":2,\"DeRoleid\":3,\"type\":\"Device\",\"serialNumber\":\"FGL2314A91L\",\"site\":\"Thai Beverage Public Company Limited\",\"assetState\":\"In Use\",\"assetNumber\":\"4300000627\",\"source\":\"site\",\"SLid\":1,\"role\":\"server\",\"manufacturer\":\"Cisco\",\"model\":\"AIR-PWRINJ6\"},{\"id\":2,\"name\":\"AIR-AP3802I-S-K9 / FGL2314A91M\",\"Dtypeid\":2,\"DeRoleid\":3,\"type\":\"Device\",\"serialNumber\":\"FGL2314A91M\",\"site\":\"Thai Beverage Public Company Limited\",\"assetState\":\"In Store\",\"assetNumber\":\"4300000579\",\"source\":\"site\",\"SLid\":1,\"role\":\"server\",\"manufacturer\":\"Cisco\",\"model\":\"AIR-PWRINJ6\"},{\"id\":3,\"name\":\"AIR-AP3802I-S-K9 / FGL2314A91N\",\"Dtypeid\":3,\"DeRoleid\":2,\"type\":\"Device\",\"serialNumber\":\"FGL2314A91N\",\"site\":\"Thai Beverage Public Company Limited\",\"assetState\":\"In Use\",\"assetNumber\":\"4300000580\",\"source\":\"site\",\"SLid\":1,\"role\":\"router\",\"manufacturer\":\"Cisco\",\"model\":\"WS-C2960X-24PS-L\"},{\"id\":5,\"name\":\"AIR-AP3802I-S-K9 / FGL2314A91Q\",\"Dtypeid\":4,\"DeRoleid\":2,\"type\":\"Device\",\"serialNumber\":\"FGL2314A91Q\",\"site\":\"Thai Beverage Public Company Limited\",\"assetState\":\"In Use\",\"assetNumber\":\"4300000582\",\"source\":\"site\",\"SLid\":1,\"role\":\"router\",\"manufacturer\":\"Cisco\",\"model\":\"AIR-AP1852I-E-K9\"},{\"id\":6,\"name\":\"AIR-AP3802I-S-K9 / FGL2314A91R\",\"Dtypeid\":3,\"DeRoleid\":2,\"type\":\"Device\",\"serialNumber\":\"FGL2314A91R\",\"site\":\"Thai Beverage Public Company Limited\",\"assetState\":\"In Store\",\"assetNumber\":\"4300000583\",\"source\":\"site\",\"SLid\":1,\"role\":\"router\",\"manufacturer\":\"Cisco\",\"model\":\"WS-C2960X-24PS-L\"},{\"id\":7,\"name\":\"AIR-AP3802I-S-K9 / FGL2314A91S\",\"Dtypeid\":1,\"DeRoleid\":1,\"type\":\"Device\",\"serialNumber\":\"FGL2314A91S\",\"site\":\"Thai Beverage Public Company Limited\",\"assetState\":\"In Use\",\"assetNumber\":\"4300000584\",\"source\":\"site\",\"SLid\":1,\"role\":\"switch\",\"manufacturer\":\"Cisco\",\"model\":\"AIR-AP3802I-S-K9\"},{\"id\":8,\"name\":\"AIR-AP3802I-S-K9 / FGL2314A91T\",\"Dtypeid\":1,\"DeRoleid\":1,\"type\":\"Device\",\"serialNumber\":\"FGL2314A91T\",\"site\":\"Thai Beverage Public Company Limited\",\"assetState\":\"In Use\",\"assetNumber\":\"4300000585\",\"source\":\"site\",\"SLid\":1,\"role\":\"switch\",\"manufacturer\":\"Cisco\",\"model\":\"AIR-AP3802I-S-K9\"},{\"id\":9,\"name\":\"AIR-AP3802I-S-K9 / FGL2314A91U\",\"Dtypeid\":1,\"DeRoleid\":1,\"type\":\"Device\",\"serialNumber\":\"FGL2314A91U\",\"site\":\"Thai Beverage Public Company Limited\",\"assetState\":\"In Use\",\"assetNumber\":\"4300000586\",\"source\":\"site\",\"SLid\":1,\"role\":\"switch\",\"manufacturer\":\"Cisco\",\"model\":\"AIR-AP3802I-S-K9\"},{\"id\":10,\"name\":\"AIR-AP3802I-S-K9 / FGL2314A91V\",\"Dtypeid\":1,\"DeRoleid\":1,\"type\":\"Device\",\"serialNumber\":\"FGL2314A91V\",\"site\":\"Thai Beverage Public Company Limited\",\"assetState\":\"In Use\",\"assetNumber\":\"4300000587\",\"source\":\"site\",\"SLid\":1,\"role\":\"switch\",\"manufacturer\":\"Cisco\",\"model\":\"AIR-AP3802I-S-K9\"},{\"id\":11,\"name\":\"AIR-AP3802I-S-K9 / FGL2314A91W\",\"Dtypeid\":1,\"DeRoleid\":1,\"type\":\"Device\",\"serialNumber\":\"FGL2314A91W\",\"site\":\"Thai Beverage Public Company Limited\",\"assetState\":\"In Store\",\"assetNumber\":\"4300000588\",\"source\":\"site\",\"SLid\":1,\"role\":\"switch\",\"manufacturer\":\"Cisco\",\"model\":\"AIR-AP3802I-S-K9\"}]', NULL, 1, 'Thai Beverage Public Company Limited - Beer Thai', NULL, NULL, 'ีี', '2026-02-11', '2026-02-11', '[{\"id\":\"9\",\"name\":\"Chainarin\",\"lastName\":\"Phosai (โบ๊ท)\"}]', NULL, 'not-started', 0, NULL, NULL, '2026-02-11 08:51:59', '2026-02-11 08:51:59');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `tasks`
--
ALTER TABLE `tasks`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `tasks`
--
ALTER TABLE `tasks`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
