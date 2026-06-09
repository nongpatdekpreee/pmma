-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: db:3306
-- Generation Time: Jun 09, 2026 at 02:38 AM
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
  `sof_name` varchar(255) DEFAULT NULL,
  `sla_term` int(11) DEFAULT NULL,
  `Assigned_Service` varchar(100) NOT NULL,
  `pm_time_per_year` enum('1','2','3','4','5') NOT NULL DEFAULT '2',
  `sale_account` text DEFAULT NULL,
  `tel_acc` varchar(20) DEFAULT NULL,
  `email_acc` text DEFAULT NULL,
  `coverage_scope` text DEFAULT NULL,
  `file_paths` text DEFAULT NULL COMMENT 'JSON array of file paths',
  `image_paths` text DEFAULT NULL COMMENT 'JSON array of image paths',
  `status` enum('draft','official','not_renewing') NOT NULL DEFAULT 'draft',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `contract_device`
--

CREATE TABLE `contract_device` (
  `contract_id` int(11) NOT NULL,
  `device_id` int(11) NOT NULL COMMENT 'FK -> devices(Did); NULL = draft site only',
  `SLid` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `contract_history`
--

CREATE TABLE `contract_history` (
  `history_id` int(11) NOT NULL,
  `contract_id` int(11) NOT NULL COMMENT 'FK -> contract(contract_id) - สัญญาใหม่',
  `old_contract_id` int(11) DEFAULT NULL COMMENT 'FK -> contract(contract_id) - สัญญาเก่าที่ต่ออายุ',
  `old_sof` varchar(255) DEFAULT NULL COMMENT 'SOF จากสัญญาเก่า',
  `new_sof` varchar(255) DEFAULT NULL COMMENT 'SOF ของสัญญาใหม่',
  `renewed_at` datetime DEFAULT current_timestamp() COMMENT 'วันที่ต่อสัญญา',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `status_history` varchar(32) DEFAULT NULL COMMENT 'Renew | Terminated',
  `terminated_reason` text DEFAULT NULL COMMENT 'Reason for termination/not renewing',
  `contract_snapshot` longtext DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ประวัติการต่อสัญญา';

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
  `Loan_Start` date DEFAULT NULL,
  `Request_Date` date DEFAULT NULL,
  `Refer_Ticket` varchar(100) DEFAULT NULL,
  `Assigned_Service` varchar(100) DEFAULT NULL,
  `Reason` enum('New Installation','Not Assigned','Replacement','') DEFAULT NULL,
  `Dtypeid` int(11) DEFAULT NULL,
  `DeRoleid` int(11) DEFAULT NULL,
  `Project_code_purchase` varchar(100) DEFAULT NULL,
  `Waranty_start` date DEFAULT NULL,
  `Waranty_end` date DEFAULT NULL,
  `Received_date` datetime DEFAULT NULL,
  `Asset_Type` varchar(100) DEFAULT NULL,
  `Owner` varchar(100) DEFAULT NULL,
  `Project_Owen` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Triggers `devices`
--
DELIMITER $$
CREATE TRIGGER `trg_devices_insert` AFTER INSERT ON `devices` FOR EACH ROW BEGIN
    DECLARE v_sid INT DEFAULT NULL;
    DECLARE v_location2 VARCHAR(255) DEFAULT NULL;
    DECLARE v_sof VARCHAR(255) DEFAULT NULL;

    IF NEW.SLid IS NOT NULL THEN
        SELECT SL.Sid, L.Location2, SL.SOF
        INTO v_sid, v_location2, v_sof
        FROM sites_location SL
        JOIN location L ON SL.lid = L.lid
        WHERE SL.SLid = NEW.SLid
        LIMIT 1;
    END IF;

    INSERT INTO devices_history (
        action_type, changed_at, Did, Asset_State, serial, CI_Name, Asset_Number,
        PR_No, Vendor, Project_purchase, Sid, Location2, PO_No, Loan_Start, Request_Date,
        Refer_SOF, Refer_Ticket, Assigned_Service, Reason, Project_code_purchase,
        Waranty_start, Waranty_end, Received_date, Asset_Type, Owner, Dtypeid, DeRoleid, Description
    ) VALUES (
        'INSERT', NOW(), NEW.Did, NEW.Asset_State, NEW.serial, NEW.CI_Name, NEW.Asset_Number,
        NEW.PR_No, NEW.Vendor, NEW.Project_purchase, v_sid, v_location2, NEW.PO_No, NEW.Loan_Start,
        NEW.Request_Date, v_sof, NEW.Refer_Ticket, NEW.Assigned_Service, NEW.Reason,
        NEW.Project_code_purchase, NEW.Waranty_start, NEW.Waranty_end, NEW.Received_date,
        NEW.Asset_Type, NEW.Owner, NEW.Dtypeid, NEW.DeRoleid, COALESCE(@status_change_description, 'Import from Excel')
    );
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `trg_devices_update` AFTER UPDATE ON `devices` FOR EACH ROW BEGIN
    DECLARE v_sid INT DEFAULT NULL;
    DECLARE v_location2 VARCHAR(255) DEFAULT NULL;
    DECLARE v_sof VARCHAR(255) DEFAULT NULL;

    IF NEW.SLid IS NOT NULL THEN
        SELECT SL.Sid, L.Location2, SL.SOF
        INTO v_sid, v_location2, v_sof
        FROM sites_location SL
        JOIN location L ON SL.lid = L.lid
        WHERE SL.SLid = NEW.SLid
        LIMIT 1;
    END IF;

    INSERT INTO devices_history (
        action_type, changed_at, Did, Asset_State, serial, CI_Name, Asset_Number,
        PR_No, Vendor, Project_purchase, Sid, Location2, PO_No, Loan_Start, Request_Date,
        Refer_SOF, Refer_Ticket, Assigned_Service, Reason, Project_code_purchase,
        Waranty_start, Waranty_end, Received_date, Asset_Type, Owner, Dtypeid, DeRoleid, Description
    ) VALUES (
        'UPDATE', NOW(), NEW.Did, NEW.Asset_State, NEW.serial, NEW.CI_Name, NEW.Asset_Number,
        NEW.PR_No, NEW.Vendor, NEW.Project_purchase, v_sid, v_location2, NEW.PO_No, NEW.Loan_Start,
        NEW.Request_Date, v_sof, NEW.Refer_Ticket, NEW.Assigned_Service, NEW.Reason,
        NEW.Project_code_purchase, NEW.Waranty_start, NEW.Waranty_end, NEW.Received_date,
        NEW.Asset_Type, NEW.Owner, NEW.Dtypeid, NEW.DeRoleid, COALESCE(@status_change_description, 'Updated')
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

-- --------------------------------------------------------

--
-- Table structure for table `manufacturer`
--

CREATE TABLE `manufacturer` (
  `Mid` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `slug` varchar(100) NOT NULL
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
-- Table structure for table `report`
--

CREATE TABLE `report` (
  `report_id` int(11) NOT NULL,
  `id` int(11) NOT NULL COMMENT 'task id',
  `file_path` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `image_path` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `sla_result` int(11) NOT NULL,
  `status` enum('Pass','Fail') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `checklist_items` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'JSON array of checklist items',
  `comment` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `technician_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `pm_date` date DEFAULT NULL,
  `device_id` int(11) DEFAULT NULL,
  `device_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'JSON of device object',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `repair_notice_paths` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'JSON array of path strings (/uploads/tasks/...)'
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

-- --------------------------------------------------------

--
-- Table structure for table `sites_location`
--

CREATE TABLE `sites_location` (
  `SLid` int(11) NOT NULL,
  `Sid` int(11) NOT NULL,
  `lid` int(11) NOT NULL,
  `SOF` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tasks`
--

CREATE TABLE `tasks` (
  `id` int(11) NOT NULL,
  `task_type` enum('PM','MA') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `contract_id` int(11) DEFAULT NULL,
  `assets` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `replacement_device_id` int(11) DEFAULT NULL,
  `site_id` int(11) DEFAULT NULL,
  `site_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `vendor_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `vendor_tel` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `reporter_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `reporter_tel` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `ticket` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `root_cause` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `resolution` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `coverage_scope` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `downtime_date` date DEFAULT NULL,
  `engineers` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `asset_binding` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `status` enum('not-started','working','stuck','done') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'not-started',
  `actually_went` tinyint(1) DEFAULT 0,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `reschedule_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `photos` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `assigned_service` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `downtime_time` time DEFAULT NULL,
  `uptime_date` date DEFAULT NULL,
  `uptime_time` time DEFAULT NULL,
  `downtime_total_hours` decimal(12,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

-- --------------------------------------------------------

--
-- Table structure for table `user_profiles`
--

CREATE TABLE `user_profiles` (
  `profile_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `gmail` varchar(150) DEFAULT NULL,
  `type` enum('Technical','Management','Engineer') NOT NULL,
  `employment` varchar(255) NOT NULL,
  `em_picture` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `user_profiles`
--

INSERT INTO `user_profiles` (`profile_id`, `user_id`, `name`, `phone`, `gmail`, `type`, `employment`, `em_picture`) VALUES
(1, 1, 'SNS Natthawat Sirisappanya', '0649649636', 'natthawat.s@shinasub.com', 'Engineer', 'Full-Time', '/uploads/employees/1779432797790-Screenshot_2026-05-22_135750.png'),
(2, 2, 'Vender CSPM', '6625039243-491', 'nattaya.a@cspm.co.th', 'Technical', 'Contract', '/uploads/employees/1779433898313-CSPM.jpg'),
(3, 3, 'Vender Synnex', '0909805273', 'dechawat_n@synnex.co.th', 'Technical', 'Contract', '/uploads/employees/1779434000884-channels4_profile.jpg');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `contract`
--
ALTER TABLE `contract`
  ADD PRIMARY KEY (`contract_id`);

--
-- Indexes for table `contract_device`
--
ALTER TABLE `contract_device`
  ADD PRIMARY KEY (`contract_id`,`device_id`),
  ADD KEY `fk_cd_device` (`device_id`),
  ADD KEY `fk_contract_device_slid` (`SLid`);

--
-- Indexes for table `contract_history`
--
ALTER TABLE `contract_history`
  ADD PRIMARY KEY (`history_id`),
  ADD KEY `idx_contract_id` (`contract_id`),
  ADD KEY `idx_old_contract_id` (`old_contract_id`);

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
-- Indexes for table `report`
--
ALTER TABLE `report`
  ADD PRIMARY KEY (`report_id`),
  ADD KEY `fk_task_id` (`id`);

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
-- Indexes for table `user_profiles`
--
ALTER TABLE `user_profiles`
  ADD PRIMARY KEY (`profile_id`),
  ADD KEY `fk_user_profiles_user` (`user_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `contract`
--
ALTER TABLE `contract`
  MODIFY `contract_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `contract_history`
--
ALTER TABLE `contract_history`
  MODIFY `history_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `devices`
--
ALTER TABLE `devices`
  MODIFY `Did` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `devices_history`
--
ALTER TABLE `devices_history`
  MODIFY `log_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `device_role`
--
ALTER TABLE `device_role`
  MODIFY `DeRoleid` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `device_type`
--
ALTER TABLE `device_type`
  MODIFY `Dtypeid` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `location`
--
ALTER TABLE `location`
  MODIFY `lid` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `manufacturer`
--
ALTER TABLE `manufacturer`
  MODIFY `Mid` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `netbox`
--
ALTER TABLE `netbox`
  MODIFY `Netid` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `report`
--
ALTER TABLE `report`
  MODIFY `report_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `sites`
--
ALTER TABLE `sites`
  MODIFY `Sid` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `sites_location`
--
ALTER TABLE `sites_location`
  MODIFY `SLid` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tasks`
--
ALTER TABLE `tasks`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `user`
--
ALTER TABLE `user`
  MODIFY `User_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `user_profiles`
--
ALTER TABLE `user_profiles`
  MODIFY `profile_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `contract_device`
--
ALTER TABLE `contract_device`
  ADD CONSTRAINT `fk_cd_contract` FOREIGN KEY (`contract_id`) REFERENCES `contract` (`contract_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_cd_device` FOREIGN KEY (`device_id`) REFERENCES `devices` (`Did`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_contract_device_slid` FOREIGN KEY (`SLid`) REFERENCES `sites_location` (`SLid`) ON DELETE SET NULL ON UPDATE CASCADE;

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
-- Constraints for table `report`
--
ALTER TABLE `report`
  ADD CONSTRAINT `fk_task_id` FOREIGN KEY (`id`) REFERENCES `tasks` (`id`);

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
