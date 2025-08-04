FROM nginx:alpine

# Clean default nginx files
RUN rm -rf /usr/share/nginx/html/*

# Copy HTML/CSS/JS files into nginx web root
COPY templatemo_589_lugx_gaming/ /usr/share/nginx/html/

# Expose nginx default port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
