import json
import pika

def main():
    connection = pika.BlockingConnection(
        pika.ConnectionParameters(host='localhost', port=5672)
    )
    channel = connection.channel()
    channel.queue_declare(queue='judge_queue', durable=True)

    code = """
import sys
data = sys.stdin.read().strip().split()
if len(data) >= 2:
    print(int(data[0]) + int(data[1]))
else:
    print("Invalid input")
"""
    input_data = "10 25\n"

    message = {
        "submission_id": 999,
        "code": code,
        "language": "python",
        "input_data": input_data,
        "timeout": 3
    }
    
    channel.basic_publish(
        exchange='',
        routing_key='judge_queue',
        body=json.dumps(message),
        properties=pika.BasicProperties(
            delivery_mode=pika.spec.PERSISTENT_DELIVERY_MODE
        ))
    print(" [x] Sent Job 999 to RabbitMQ")
    
    # Send timeout test
    infinite_loop_code = "while True: pass"
    message2 = {
        "submission_id": 1000,
        "code": infinite_loop_code,
        "language": "python",
        "input_data": "",
        "timeout": 2
    }
    channel.basic_publish(
        exchange='',
        routing_key='judge_queue',
        body=json.dumps(message2),
        properties=pika.BasicProperties(
            delivery_mode=pika.spec.PERSISTENT_DELIVERY_MODE
        ))
    print(" [x] Sent Job 1000 to RabbitMQ")
    
    connection.close()
    
    print("\nNote: The worker will publish the result to Redis Pub/Sub channel 'judge_events'.")
    print("Check the worker logs to see the execution results!")

if __name__ == '__main__':
    main()
