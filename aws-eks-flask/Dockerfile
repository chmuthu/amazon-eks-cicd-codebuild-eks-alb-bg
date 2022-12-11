FROM public.ecr.aws/docker/library/python:3.9-alpine
LABEL Author="chmuthu@amazon.com"
WORKDIR /app
COPY requirements.txt requirements.txt
RUN pip3 install -r requirements.txt
COPY . .
CMD ["python3", "app.py"]
