-- Auth users (also ensured by backend startup migration)
USE app_db;

CREATE TABLE IF NOT EXISTS user (
  User_id INT NOT NULL AUTO_INCREMENT,
  Username VARCHAR(255) NOT NULL,
  Password VARCHAR(255) NOT NULL,
  Role VARCHAR(50) NOT NULL DEFAULT 'user',
  PRIMARY KEY (User_id),
  UNIQUE KEY idx_user_username (Username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
