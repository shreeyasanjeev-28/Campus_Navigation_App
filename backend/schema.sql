-- Schema for CampusNavigationSystem (MySQL)
CREATE DATABASE IF NOT EXISTS `CampusNavigationSystem`;
USE `CampusNavigationSystem`;

CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) UNIQUE,
  password_hash VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS locations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) UNIQUE,
  latitude DOUBLE,
  longitude DOUBLE,
  type VARCHAR(50) DEFAULT 'building'
);

CREATE TABLE IF NOT EXISTS paths (
  id INT AUTO_INCREMENT PRIMARY KEY,
  from_id INT,
  to_id INT,
  distance DOUBLE,
  FOREIGN KEY (from_id) REFERENCES locations(id),
  FOREIGN KEY (to_id) REFERENCES locations(id)
);

-- Default admin created automatically by server.js
