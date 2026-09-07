FROM php:8.2-apache

# Install PostgreSQL client libraries for PHP
RUN apt-get update && apt-get install -y libpq-dev \
    && docker-php-ext-install pdo pdo_pgsql

# Enable Apache mod_rewrite (optional but useful)
RUN a2enmod rewrite

# Copy project files to the container
COPY . /var/www/html/

# Set working directory
WORKDIR /var/www/html/

# Ensure the uploads directory exists and is writable
RUN mkdir -p uploads && chmod -R 777 uploads

# Expose port 80
EXPOSE 80

# The base image already has "apache2-foreground" as the default CMD
