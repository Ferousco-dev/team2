FROM php:8.2-apache

# Install PostgreSQL client libraries for PHP
RUN apt-get update && apt-get install -y libpq-dev \
    && docker-php-ext-install pdo pdo_pgsql

# Enable Apache mod_rewrite (optional but useful)
RUN a2enmod rewrite

# Match the frontend's 5 MB CV limit, with room for multipart form fields.
RUN printf 'upload_max_filesize=5M\npost_max_size=6M\n' > /usr/local/etc/php/conf.d/uploads.ini

# Copy project files to the container
COPY . /var/www/html/

# Set working directory
WORKDIR /var/www/html/

# Ensure the uploads directory exists and is writable
RUN mkdir -p uploads && chmod -R 777 uploads

# Expose port 80
EXPOSE 80

# The base image already has "apache2-foreground" as the default CMD
